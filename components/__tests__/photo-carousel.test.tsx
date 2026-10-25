import { render, screen } from '@testing-library/react'
import PhotoCarousel from '../photo-carousel'

test('carousel renders placeholder when no photos', () => {
  render(<PhotoCarousel photos={[]} />)
  expect(screen.getByTestId('photo-placeholder')).toBeInTheDocument()
})
