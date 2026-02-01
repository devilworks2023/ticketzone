import React from 'react';

type StripeHook = {
  initPaymentSheet: (params: any) => Promise<{ error?: any }>;
  presentPaymentSheet: () => Promise<{ error?: any }>;
};

type StripeProviderProps = {
  publishableKey: string;
  children: React.ReactNode;
};

const mockUseStripe = (): StripeHook => ({
  initPaymentSheet: async () => ({}),
  presentPaymentSheet: async () => ({}),
});

const MockStripeProvider: React.FC<StripeProviderProps> = ({ children }) => {
  return React.createElement(React.Fragment, null, children);
};

export const useStripe = mockUseStripe;
export const StripeProvider = MockStripeProvider;
