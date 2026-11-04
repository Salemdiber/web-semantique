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

const FormationsOntology = () => {
    const [formations, setFormations] = useState<Formation[]>([])
    const [erreur, setErreur] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [inscriptionEnCours, setInscriptionEnCours] = useState<string | null>(
        null
    )
    const { utilisateur } = useSession()

    useEffect(() => {
        const charger = async () => {
            try {
                const reponse = await fetch(`${API_URL}/education/formations`)
                if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
                setFormations(await reponse.json())
            } catch {
                setErreur(
                    "Impossible de charger les formations depuis l'API sémantique."
                )
            }
        }

        charger()
    }, [])

    const inscrire = async (formation: Formation) => {
        const jeton = lireJetonSession()
        if (!jeton) {
            setMessage('Connectez-vous pour rejoindre une formation.')
            return
        }

        setInscriptionEnCours(formation.id)
        setMessage(null)
        try {
            const reponse = await fetch(
                `${API_URL}/education/formations/${encodeURIComponent(
                    formation.id
                )}/inscription`,
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${jeton}` },
                }
            )
            const corps = await reponse.json()
            if (!reponse.ok) {
                throw new Error(
                    typeof corps?.detail === 'string'
                        ? corps.detail
                        : 'Inscription impossible.'
                )
            }
            setMessage(corps.message)
        } catch (cause) {
            setMessage(
                cause instanceof Error
                    ? cause.message
                    : 'Inscription impossible.'
            )
        } finally {
            setInscriptionEnCours(null)
        }
    }

    return (
        <section id="formations-ontologie" className="section-tb bg-white">
            <div className="container mx-auto">
                <div className="mb-10 text-center">
                    <span className="mb-2 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                        Formations disponibles
                    </span>
                    <h2 className="text-3xl font-bold sm:text-4xl">
                        Nos formations
                    </h2>
                    <p className="mt-4 text-lg text-gray-600">
                        Découvrez les parcours proposés par la plateforme.
                    </p>
                </div>

                {erreur && (
                    <p className="text-center text-gray-600">{erreur}</p>
                )}

                {message && (
                    <p className="mb-6 text-center text-sm font-medium text-primary">
                        {message}
                    </p>
                )}

                {!erreur && formations.length === 0 && (
                    <p className="text-center text-gray-600">
                        Aucune formation disponible pour le moment.
                    </p>
                )}

                {!erreur && formations.length > 0 && (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {formations.map((formation) => (
                            <article
                                key={formation.id}
                                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                            >
                                <div className="mb-4 flex items-start justify-between gap-4">
                                    <h3 className="text-xl font-bold text-gray-900">
                                        {formation.nom}
                                    </h3>
                                    <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                        Formation
                                    </span>
                                </div>
                                <p className="mb-4 text-sm text-gray-600">
                                    Durée : {formation.duree}
                                </p>
                                {formation.description && (
                                    <p className="mb-4 text-sm leading-6 text-gray-600">
                                        {formation.description}
                                    </p>
                                )}
                                <div className="space-y-3 border-t border-gray-100 pt-4 text-sm">
                                    {formation.programme && (
                                        <p>
                                            <strong>Programme :</strong>{' '}
                                            {formation.programme}
                                        </p>
                                    )}
                                    {formation.certification && (
                                        <p>
                                            <strong>Certification :</strong>{' '}
                                            {formation.certification}
                                        </p>
                                    )}
                                    <p>
                                        <strong>Cours :</strong>{' '}
                                        {formation.cours.length > 0
                                            ? formation.cours.join(', ')
                                            : 'À venir'}
                                    </p>
                                </div>
                                {utilisateur?.role === 'etudiant' && (
                                    <button
                                        type="button"
                                        onClick={() => inscrire(formation)}
                                        disabled={
                                            inscriptionEnCours === formation.id
                                        }
                                        className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {inscriptionEnCours === formation.id
                                            ? 'Inscription...'
                                            : 'Rejoindre la formation'}
                                    </button>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

export default FormationsOntology
