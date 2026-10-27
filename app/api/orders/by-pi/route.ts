import { NextRequest, NextResponse } from 'next/server'
import { getOrderByPaymentIntentId } from '@/lib/data/orders'

export async function GET(request: NextRequest) {
  const pi = request.nextUrl.searchParams.get('pi')
  if (!pi) {
    return NextResponse.json(null, { status: 400 })
  }

  const order = await getOrderByPaymentIntentId(pi)
  return NextResponse.json(order)
}
