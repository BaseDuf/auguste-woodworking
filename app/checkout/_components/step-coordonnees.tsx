'use client'

import { useState } from 'react'

export type Coordonnees = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

type Props = {
  onNext: (data: Coordonnees) => void
  initialData?: Coordonnees | null
}

export function StepCoordonnees({ onNext, initialData }: Props) {
  const [firstName, setFirstName] = useState(initialData?.firstName ?? '')
  const [lastName, setLastName] = useState(initialData?.lastName ?? '')
  const [email, setEmail] = useState(initialData?.email ?? '')
  const [phone, setPhone] = useState(initialData?.phone ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onNext({ firstName, lastName, email, phone })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold text-stone-900">Vos coordonnées</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-stone-700 mb-1">
            Prénom <span className="text-red-500">*</span>
          </label>
          <input
            id="firstName"
            type="text"
            required
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-stone-700 mb-1">
            Nom <span className="text-red-500">*</span>
          </label>
          <input
            id="lastName"
            type="text"
            required
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
          E-mail <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-stone-700 mb-1">
          Téléphone
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="createAccount"
          type="checkbox"
          disabled
          className="cursor-not-allowed opacity-50"
        />
        <label htmlFor="createAccount" className="text-sm text-stone-500 cursor-not-allowed">
          Créer un compte — <span className="italic">Bientôt disponible</span>
        </label>
      </div>

      <button
        type="submit"
        className="w-full bg-stone-900 text-white py-3 rounded-md font-medium hover:bg-stone-700 transition-colors"
      >
        Continuer
      </button>
    </form>
  )
}
