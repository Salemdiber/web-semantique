import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '@/utils/session'

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'
const DASHBOARD_URL: string =
    import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:5173'

interface Statistique {
    classe: string
    nom: string
    nombre: number
}

const INDICATEURS = [
    { classe: 'Cours', libelle: 'cours' },
    { classe: 'Etudiant', libelle: 'étudiants' },
    { classe: 'Formateur', libelle: 'formateurs' },
    { classe: 'Certification', libelle: 'certifications' },
]

const Banner = () => {
    const [statistiques, setStatistiques] = useState<Statistique[]>([])
    const { utilisateur, chargement } = useSession()

    useEffect(() => {
        let actif = true
        fetch(`${API_URL}/education/statistiques`)
            .then((reponse) => (reponse.ok ? reponse.json() : []))
            .then((donnees: Statistique[]) => {
                if (actif) setStatistiques(donnees)
            })
            .catch(() => {
                /* indicateurs masqués si l'API est indisponible */
            })
        return () => {
            actif = false
        }
    }, [])

    const compteur = (classe: string) =>
        statistiques.find((s) => s.classe === classe)?.nombre

    return (
        <section id='Home' className='bg-banner-image pt-28 pb-20'>
            <div className='relative px-6 lg:px-8'>
                <div className='container'>
                    <div className='flex flex-col gap-5 text-center'>
                        <span className='mx-auto rounded-full bg-white/60 px-4 py-1.5 text-sm font-medium text-primary'>
                            Ontologie OWL · SPARQL · Jena Fuseki
                        </span>
                        <h1 className='leading-tight font-bold tracking-tight max-w-4xl mx-auto text-gray-900'>
                            La plateforme Éducation &amp; Formation
                        </h1>
                        <p className='text-lg leading-8 text-gray-700 max-w-2xl mx-auto'>
                            Cours, formateurs, compétences et certifications issus
                            d'une ontologie OWL interrogeable en SPARQL.
                        </p>

                        <div className='flex flex-wrap justify-center gap-3 pt-2'>
                            <Link
                                to='/#catalogue-ontologie'
                                className='bg-primary text-white font-semibold px-6 py-3 rounded-lg border border-primary hover:bg-transparent hover:text-primary duration-300'>
                                Explorer les cours
                            </Link>
                            {!chargement &&
                                (utilisateur ? (
                                    <a
                                        href={DASHBOARD_URL}
                                        className='bg-white/70 text-primary font-semibold px-6 py-3 rounded-lg border border-primary hover:bg-primary hover:text-white duration-300'>
                                        Mon tableau de bord
                                    </a>
                                ) : (
                                    <a
                                        href={`${DASHBOARD_URL}/auth/auth2/login`}
                                        className='bg-white/70 text-primary font-semibold px-6 py-3 rounded-lg border border-primary hover:bg-primary hover:text-white duration-300'>
                                        Se connecter
                                    </a>
                                ))}
                        </div>
                    </div>

                    {statistiques.length > 0 && (
                        <div className='mx-auto max-w-3xl mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4'>
                            {INDICATEURS.map((indicateur) => (
                                <div
                                    key={indicateur.classe}
                                    className='rounded-lg bg-white/70 border border-white/40 p-4 text-center shadow-sm'>
                                    <p className='text-2xl font-bold text-gray-900'>
                                        {compteur(indicateur.classe) ?? '—'}
                                    </p>
                                    <p className='text-sm text-gray-600'>
                                        {indicateur.libelle}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

export default Banner
