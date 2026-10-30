import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Lightbox from '../lightbox'
import type { RealisationWithPhotos } from '@/lib/data/realisations'

const makeRealisation = (photoCount: number): RealisationWithPhotos => ({
  id: 'r1',
  title: 'Chantier test',
  description: null,
  created_at: '2026-01-01T00:00:00Z',
  realisation_photos: Array.from({ length: photoCount }, (_, i) => ({
    id: `p${i}`,
    realisation_id: 'r1',
    url: `https://cdn.example.com/photo${i}.jpg`,
    position: i,
  })),
})

describe('Lightbox', () => {
  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<Lightbox realisation={makeRealisation(2)} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates to next photo on ArrowRight', () => {
    const { getByRole } = render(
      <Lightbox realisation={makeRealisation(3)} onClose={vi.fn()} />
    )
    const counter = getByRole('status')
    expect(counter.textContent).toBe('1 / 3')
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(counter.textContent).toBe('2 / 3')
  })

  it('does not go past last photo on ArrowRight', () => {
    const { getByRole } = render(
      <Lightbox realisation={makeRealisation(2)} onClose={vi.fn()} />
    )
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(getByRole('status').textContent).toBe('2 / 2')
  })

  it('does not go before first photo on ArrowLeft', () => {
    const { getByRole } = render(
      <Lightbox realisation={makeRealisation(2)} onClose={vi.fn()} />
    )
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(getByRole('status').textContent).toBe('1 / 2')
  })

  it('calls onClose immediately when realisation has no photos', () => {
    const onClose = vi.fn()
    render(<Lightbox realisation={makeRealisation(0)} onClose={onClose} />)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
