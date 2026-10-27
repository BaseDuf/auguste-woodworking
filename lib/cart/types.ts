export type CartItem = {
  productId: string
  slug: string
  name: string
  price_cents: number
  shipping_price_cents: number
  stock: number
  allow_preorder: boolean
  photo_url: string | null
  quantity: number
}
