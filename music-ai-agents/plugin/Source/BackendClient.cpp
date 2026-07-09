#include "BackendClient.h"

using namespace juce;

// tRPC + superjson: las mutations van por POST con cuerpo {"json": <input>},
// las queries por GET con ?input=<url-encoded {"json": <input>}>. La respuesta
// es {"result":{"data":{"json": <output>}}}. (Formatos verificados contra el
// backend real.)

static var extractData (const String& body, bool& ok)
{
    var parsed = JSON::parse (body);
    if (auto* obj = parsed.getDynamicObject())
    {
        var result = parsed["result"];
        var data = result["data"];
        var json = data["json"];
        if (! json.isVoid()) { ok = true; return json; }
    }
    ok = false;
    return {};
}

static String httpGet (const String& url, bool& ok)
{
    URL u (url);
    auto opts = URL::InputStreamOptions (URL::ParameterHandling::inAddress)
                    .withConnectionTimeoutMs (30000);
    std::unique_ptr<InputStream> in (u.createInputStream (opts));
    if (in == nullptr) { ok = false; return {}; }
    ok = true;
    return in->readEntireStreamAsString();
}

static String httpPostJson (const String& url, const String& jsonBody, bool& ok)
{
    URL u (url);
    u = u.withPOSTData (jsonBody);
    StringPairArray headers;
    auto opts = URL::InputStreamOptions (URL::ParameterHandling::inPostData)
                    .withConnectionTimeoutMs (60000)
                    .withExtraHeaders ("Content-Type: application/json\r\n");
    std::unique_ptr<InputStream> in (u.createInputStream (opts));
    if (in == nullptr) { ok = false; return {}; }
    ok = true;
    return in->readEntireStreamAsString();
}

var BackendClient::trpcMutation (const String& proc, const var& input, bool& ok)
{
    DynamicObject::Ptr wrapper (new DynamicObject());
    wrapper->setProperty ("json", input);
    String body = JSON::toString (var (wrapper.get()));
    String resp = httpPostJson (base + "/api/trpc/" + proc, body, ok);
    if (! ok) return {};
    return extractData (resp, ok);
}

var BackendClient::trpcQuery (const String& proc, const var& input, bool& ok)
{
    DynamicObject::Ptr wrapper (new DynamicObject());
    wrapper->setProperty ("json", input);
    String encoded = URL::addEscapeChars (JSON::toString (var (wrapper.get())), true);
    String resp = httpGet (base + "/api/trpc/" + proc + "?input=" + encoded, ok);
    if (! ok) return {};
    return extractData (resp, ok);
}

MemoryBlock BackendClient::decodeBase64 (const String& b64)
{
    MemoryOutputStream out;
    Base64::convertFromBase64 (out, b64);
    return out.getMemoryBlock();
}

BackendClient::Result BackendClient::analyze (const MemoryBlock& wavData)
{
    Result r;
    if (onStage) onStage ("subiendo audio");

    // 1) startAnalysis (mutation) -> { jobId }
    String audioB64 = Base64::toBase64 (wavData.getData(), wavData.getSize());
    DynamicObject::Ptr startInput (new DynamicObject());
    startInput->setProperty ("base64Audio", audioB64);
    startInput->setProperty ("fileName", "capture.wav");

    bool ok = false;
    var started = trpcMutation ("tracks.startAnalysis", var (startInput.get()), ok);
    if (! ok) { r.message = "No se pudo contactar el backend (startAnalysis)."; return r; }

    String jobId = started["jobId"].toString();
    if (jobId.isEmpty()) { r.message = "El backend no devolvió jobId."; return r; }

    // 2) polling de getJob hasta done/error (hasta ~20 min)
    String analysisId;
    for (int i = 0; i < 480; ++i)
    {
        Thread::sleep (2500);
        DynamicObject::Ptr jinput (new DynamicObject());
        jinput->setProperty ("jobId", jobId);
        bool jok = false;
        var job = trpcQuery ("tracks.getJob", var (jinput.get()), jok);
        if (! jok) continue;

        String status = job["status"].toString();
        String stage = job["stage"].toString();
        if (onStage && stage.isNotEmpty()) onStage (stage);

        if (status == "done") { analysisId = job["analysisId"].toString(); break; }
        if (status == "error") { r.message = "El análisis falló: " + job["error"].toString(); return r; }
    }
    if (analysisId.isEmpty()) { r.message = "Tiempo de espera agotado."; return r; }

    // 3) getAnalysisById (query) -> AnalysisResult
    if (onStage) onStage ("descargando MIDIs");
    DynamicObject::Ptr ainput (new DynamicObject());
    ainput->setProperty ("id", analysisId);
    bool aok = false;
    var a = trpcQuery ("tracks.getAnalysisById", var (ainput.get()), aok);
    if (! aok) { r.message = "No se pudo descargar el análisis."; return r; }

    r.bpm = (double) a["bpm"];
    r.key = a["key"]["name"].toString();
    r.transcribed = (bool) a["transcribed"];

    if (a["fullMidiBase64"].isString())
        r.fullMidi = decodeBase64 (a["fullMidiBase64"].toString());

    if (auto* arr = a["transcribedInstruments"].getArray())
    {
        for (auto& item : *arr)
        {
            Instrument ins;
            ins.name = item["name"].toString();
            ins.program = (int) item["program"];
            ins.isDrum = (bool) item["isDrum"];
            ins.noteCount = (int) item["noteCount"];
            ins.midi = decodeBase64 (item["midiBase64"].toString());
            r.instruments.add (ins);
        }
    }

    r.ok = true;
    r.message = r.transcribed
                    ? "Listo: " + String (r.instruments.size()) + " instrumentos."
                    : "Analizado (sin transcripción por instrumento).";
    return r;
}
