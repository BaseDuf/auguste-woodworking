import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'

// Ensure DOM is cleaned up after each test (required with @testing-library/react v16 + Vitest)
afterEach(() => {
  cleanup()
})
