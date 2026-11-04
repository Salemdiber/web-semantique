import { useEffect, useState } from 'react'
import { lireJetonSession, useSession } from '@/utils/session'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

type Formation = {
    id: string
    nom: string
    duree: string
    description: string | null
    programme: string | null
    certification: string | null
    cours: string[]
}

const MesFormations = () => {
    const [formations, setFormations] = useState<Formation[]>([])
    const [chargement, setChargement] = useState(true)
    const [erreur, setErreur] = useState<string | null>(null)
    const { utilisateur } = useSession()

    useEffect(() => {
        const jeton = lireJetonSession()
        if (!jeton) {
            setChargement(false)
            return
        }

        fetch(`${API_URL}/education/mes-formations`, {
            headers: { Authorization: 'Bearer ' + jeton },
        })
            .then(async (reponse) => {
                if (!reponse.ok) {
                    const corps = await reponse.json().catch(() => null)
                    throw new Error(
                        typeof corps?.detail === 'string'
                            ? corps.detail
                            : 'Impossible de charger vos formations.'
                    )
                }
                return reponse.json() as Promise<Formation[]>
            })
            .then(setFormations)
            .catch((cause) =>
                setErreur(
                    cause instanceof Error
                        ? cause.message
                        : 'Impossible de charger vos formations.'
                )
            )
            .finally(() => setChargement(false))
    }, [])

    if (utilisateur?.role !== 'etudiant') return null

    return (
        <section id="mes-formations" className="section-tb bg-primary/5">
            <div className="container mx-auto">
                <div className="mb-10 text-center">
                    <span className="mb-2 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                        Espace étudiant
                    </span>
                    <h2 className="text-3xl font-bold sm:text-4xl">
                        Mes formations
                    </h2>
                    <p className="mt-4 text-lg text-gray-600">
                        Retrouvez les formations que vous suivez.
                    </p>
                </div>

                {chargement && (
                    <p className="text-center text-gray-600">Chargement...</p>
                )}
                {erreur && (
                    <p className="text-center text-red-600">{erreur}</p>
                )}
                {!chargement && !erreur && formations.length === 0 && (
                    <p className="text-center text-gray-600">
                        Vous n'êtes inscrit à aucune formation.
                    </p>
                )}
                {!chargement && !erreur && formations.length > 0 && (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {formations.map((formation) => (
                            <article
                                key={formation.id}
                                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                            >
                                <h3 className="text-xl font-bold text-gray-900">
                                    {formation.nom}
                                </h3>
                                <p className="mt-3 text-sm text-gray-600">
                                    Durée : {formation.duree}
                                </p>
                                {formation.description && (
                                    <p className="mt-4 text-sm leading-6 text-gray-600">
                                        {formation.description}
                                    </p>
                                )}
                                <div className="mt-4 border-t border-gray-100 pt-4 text-sm">
                                    <strong>Cours à suivre :</strong>{' '}
                                    {formation.cours.length > 0
                                        ? formation.cours.join(', ')
                                        : 'Aucun cours disponible pour le moment'}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

export default MesFormations
