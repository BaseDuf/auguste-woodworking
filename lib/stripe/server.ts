import Stripe from 'stripe'

let stripe: Stripe | null = null

export function getStripeServer(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return stripe
}
