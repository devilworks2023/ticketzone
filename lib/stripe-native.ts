import { Platform } from 'react-native';
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

let useStripeHook: () => StripeHook = mockUseStripe;
let StripeProviderComponent: React.ComponentType<StripeProviderProps> = MockStripeProvider;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const stripe = require('@stripe/stripe-react-native');
    useStripeHook = stripe.useStripe;
    StripeProviderComponent = stripe.StripeProvider;
  } catch {
    console.log('Stripe native module not available');
  }
}

export const useStripe = useStripeHook;
export const StripeProvider = StripeProviderComponent;
