import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import LoginPage from '../login/page'

test('login page renders email and password fields', () => {
  render(<LoginPage />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument()
})
