export default function VercelAnalyticsLink(): JSX.Element {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-stone-700 mb-2">Statistiques de visites</h3>
      <p className="text-sm text-stone-500 mb-3">
        Consultez les statistiques de trafic, les pages vues et les visiteurs uniques sur le tableau de bord Vercel Analytics.
      </p>
      <a
        href="https://vercel.com/analytics"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-sm font-medium text-stone-800 hover:text-stone-600 underline"
      >
        Ouvrir Vercel Analytics →
      </a>
    </div>
  )
}
