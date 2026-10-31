import { Link } from 'react-router'
import withBasePath from '@/utils/basePath'

const LIENS = [
    { label: 'Accueil', href: '/#Home' },
    { label: 'Cours', href: '/#catalogue-ontologie' },
    { label: 'Formateurs', href: '/#mentors-section' },
]

const Footer = () => {
    return (
        <footer className='bg-primary'>
            <div className='container py-12'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-10'>
                    <div className='flex flex-col gap-4'>
                        <img
                            src={withBasePath('/images/logo/logo2.svg')}
                            alt='Logo'
                            width={48}
                            height={64}
                        />
                        <p className='text-white text-lg font-medium leading-7'>
                            Plateforme Éducation &amp; Formation, alimentée par une
                            ontologie OWL et interrogée en SPARQL.
                        </p>
                    </div>

                    <div>
                        <p className='text-white text-xl font-semibold mb-4'>
                            Navigation
                        </p>
                        <ul className='flex flex-col gap-2'>
                            {LIENS.map((lien) => (
                                <li key={lien.href}>
                                    <Link
                                        to={lien.href}
                                        className='text-gray-300 hover:text-white text-sm'>
                                        {lien.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <p className='text-white text-xl font-semibold mb-4'>
                            Technologies
                        </p>
                        <ul className='flex flex-col gap-2 text-sm text-gray-300'>
                            <li>FastAPI · Python</li>
                            <li>Apache Jena Fuseki · TDB2</li>
                            <li>React · Vite · Tailwind CSS</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className='border-t border-white/20 py-4'>
                <p className='text-center text-sm text-gray-300'>
                    © 2026 SI Éducation — Projet ontologie Éducation &amp; Formation
                </p>
            </div>
        </footer>
    )
}

export default Footer
