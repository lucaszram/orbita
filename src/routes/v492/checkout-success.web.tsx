import { Redirect } from "expo-router";
import { OrbitaCheckoutReturn } from "@/components/web/orbita-checkout-return";

// Stripe redirige acá: `success_url` = `{WEB_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`.
// El nombre lo fija el backend; llegar a esta URL no significa que la compra
// haya prosperado, sólo que Stripe devolvió el control.
export default function CheckoutSuccessRoute() {
  if (process.env.EXPO_OS !== "web") {
    return <Redirect href="/" />;
  }

  return <OrbitaCheckoutReturn />;
}
