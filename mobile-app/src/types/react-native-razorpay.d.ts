declare module "react-native-razorpay" {
  interface RazorpayOptions {
    key: string;
    amount: number;
    currency?: string;
    name?: string;
    description?: string;
    order_id?: string;
    theme?: { color?: string };
    prefill?: { name?: string; email?: string; contact?: string };
  }
  interface RazorpayPayment {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }
  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpayPayment>;
  };
  export default RazorpayCheckout;
}
