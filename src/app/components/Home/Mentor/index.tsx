import { useEffect, useState } from 'react'

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

interface Formateur {
    id: string
    prenom: string
    domaine: string
    cours: string[]
}

const Mentor = () => {
    const [formateurs, setFormateurs] = useState<Formateur[]>([])
    const [loading, setLoading] = useState(true)
    const [erreur, setErreur] = useState('')

    useEffect(() => {
        let actif = true
        fetch(`${API_URL}/education/formateurs`)
            .then((reponse) => {
                if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
                return reponse.json()
            })
            .then((donnees: Formateur[]) => {
                if (actif) setFormateurs(donnees)
            })
            .catch(() => {
                if (actif) setErreur('Les formateurs sont momentanément indisponibles.')
            })
            .finally(() => {
                if (actif) setLoading(false)
            })
        return () => {
            actif = false
        }
    }, [])

    const initiales = (nom: string) =>
        nom
            .split(/\s+/)
            .map((mot) => mot[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase()

    return (
        <section id='mentors-section' className='py-14 bg-cream'>
            <div className='container'>
                <div className='mb-10'>
                    <h2 className='font-bold tracking-tight text-gray-900'>
                        Nos formateurs
                    </h2>
                    <p className='mt-2 text-gray-600'>
                        Les formateurs et leurs domaines, tels qu'enregistrés dans
                        l'ontologie.
                    </p>
                </div>

                {loading ? (
                    <p className='text-gray-600'>Chargement des formateurs…</p>
                ) : erreur ? (
                    <p className='text-gray-600'>{erreur}</p>
                ) : formateurs.length === 0 ? (
                    <p className='text-gray-600'>Aucun formateur enregistré.</p>
                ) : (
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8'>
                        {formateurs.map((formateur) => (
                            <div
                                key={formateur.id}
                                className='rounded-xl bg-white shadow-lg p-6 flex flex-col gap-4'>
                                <div className='flex items-center gap-4'>
                                    <span className='h-12 w-12 rounded-full bg-primary text-white font-semibold flex items-center justify-center'>
                                        {initiales(formateur.prenom)}
                                    </span>
                                    <div>
                                        <p className='text-lg font-semibold text-gray-900'>
                                            {formateur.prenom}
                                        </p>
                                        <p className='text-sm text-gray-600'>
                                            {formateur.domaine}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className='text-sm font-medium text-gray-700 mb-2'>
                                        Cours enseignés
                                    </p>
                                    {formateur.cours.length > 0 ? (
                                        <div className='flex flex-wrap gap-2'>
                                            {formateur.cours.map((cours) => (
                                                <span
                                                    key={cours}
                                                    className='rounded-full bg-cream px-3 py-1 text-xs font-medium text-gray-700'>
                                                    {cours}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className='text-sm text-gray-500'>
                                            Aucun cours associé
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

export default Mentor
