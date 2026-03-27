import { useStripe as useStripeNative, StripeProvider as StripeProviderNative } from '@stripe/stripe-react-native';

export const useStripe = useStripeNative;
export const StripeProvider = StripeProviderNative;
