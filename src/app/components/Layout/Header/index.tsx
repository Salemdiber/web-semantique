import { useEffect, useRef, useState } from 'react'
import Logo from './Logo'
import { Icon } from '@iconify/react/dist/iconify.js'
import { Link } from 'react-router'
import { useSession } from '@/utils/session'

const DASHBOARD_URL: string =
    import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:5173'

const NAVIGATION = [
    { label: 'Accueil', href: '/#Home' },
    { label: 'Cours', href: '/#catalogue-ontologie' },
    { label: 'Formateurs', href: '/#mentors-section' },
]

const Header: React.FC = () => {
    const [navbarOpen, setNavbarOpen] = useState(false)
    const [sticky, setSticky] = useState(false)
    const mobileMenuRef = useRef<HTMLDivElement>(null)
    const { utilisateur, chargement, prenom } = useSession()

    useEffect(() => {
        const handleScroll = () => setSticky(window.scrollY >= 10)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                mobileMenuRef.current &&
                !mobileMenuRef.current.contains(event.target as Node) &&
                navbarOpen
            ) {
                setNavbarOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [navbarOpen])

    useEffect(() => {
        document.body.style.overflow = navbarOpen ? 'hidden' : ''
    }, [navbarOpen])

    return (
        <header
            className={`fixed top-0 z-40 w-full transition-all duration-300 ${
                sticky ? 'shadow-lg bg-white py-4' : 'shadow-none py-4'
            }`}>
            <div>
                <div className='container mx-auto max-w-7xl px-4 flex items-center justify-between'>
                    <Logo />
                    <nav className='hidden lg:flex grow items-center gap-8 justify-start ml-14'>
                        {NAVIGATION.map((item) => (
                            <Link
                                key={item.href}
                                to={item.href}
                                className='text-base font-medium text-black hover:text-primary capitalized'>
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className='flex items-center gap-4'>
                        {!chargement &&
                            (utilisateur ? (
                                <>
                                    <span className='hidden lg:block text-sm font-medium text-gray-700'>
                                        Bonjour, {prenom}
                                    </span>
                                    <a
                                        href={DASHBOARD_URL}
                                        className='hidden lg:block bg-primary text-white text-base font-semibold hover:bg-transparent duration-300 hover:text-primary border-2 border-primary px-6 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg'>
                                        Mon espace
                                    </a>
                                </>
                            ) : (
                                <>
                                    <a
                                        href={`${DASHBOARD_URL}/auth/auth2/login`}
                                        className='hidden lg:block bg-transparent text-primary border-2 border-primary hover:bg-primary hover:text-white duration-300 px-6 py-2.5 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md'>
                                        Se connecter
                                    </a>
                                    <a
                                        href={`${DASHBOARD_URL}/auth/auth2/register`}
                                        className='hidden lg:block bg-primary text-white text-base font-semibold hover:bg-transparent duration-300 hover:text-primary border-2 border-primary px-6 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg'>
                                        Créer un compte
                                    </a>
                                </>
                            ))}
                        <button
                            onClick={() => setNavbarOpen(!navbarOpen)}
                            className='block lg:hidden p-2 rounded-lg'
                            aria-label='Toggle mobile menu'>
                            <span className='block w-6 h-0.5 bg-black'></span>
                            <span className='block w-6 h-0.5 bg-black mt-1.5'></span>
                            <span className='block w-6 h-0.5 bg-black mt-1.5'></span>
                        </button>
                    </div>
                </div>
                {navbarOpen && (
                    <div className='fixed top-0 left-0 w-full h-full bg-black/50 z-40' />
                )}
                <div
                    ref={mobileMenuRef}
                    className={`lg:hidden fixed top-0 right-0 h-full w-full bg-white shadow-lg transform transition-transform duration-300 max-w-xs ${
                        navbarOpen ? 'translate-x-0' : 'translate-x-full'
                    } z-50`}>
                    <div className='flex items-center justify-between p-4'>
                        <h2 className='text-lg font-bold text-midnight_text'>
                            <Logo />
                        </h2>
                        <button
                            onClick={() => setNavbarOpen(false)}
                            className='bg-black/30 rounded-full p-1 text-white'
                            aria-label='Close menu Modal'>
                            <Icon
                                icon={'material-symbols:close-rounded'}
                                width={24}
                                height={24}
                            />
                        </button>
                    </div>
                    <nav className='flex flex-col items-start p-4'>
                        {NAVIGATION.map((item) => (
                            <Link
                                key={item.href}
                                to={item.href}
                                onClick={() => setNavbarOpen(false)}
                                className='w-full py-2.5 text-base font-medium text-black hover:text-primary'>
                                {item.label}
                            </Link>
                        ))}
                        <div className='mt-4 flex flex-col gap-4 w-full'>
                            {!chargement &&
                                (utilisateur ? (
                                    <a
                                        href={DASHBOARD_URL}
                                        className='text-center bg-primary text-white px-4 py-2 rounded-lg border border-primary hover:text-primary hover:bg-transparent transition duration-300'>
                                        Mon espace ({prenom})
                                    </a>
                                ) : (
                                    <>
                                        <a
                                            href={`${DASHBOARD_URL}/auth/auth2/login`}
                                            className='text-center bg-transparent text-primary border border-primary px-4 py-2 rounded-lg hover:bg-primary hover:text-white transition duration-300'>
                                            Se connecter
                                        </a>
                                        <a
                                            href={`${DASHBOARD_URL}/auth/auth2/register`}
                                            className='text-center bg-primary text-white px-4 py-2 rounded-lg border border-primary hover:text-primary hover:bg-transparent transition duration-300'>
                                            Créer un compte
                                        </a>
                                    </>
                                ))}
                        </div>
                    </nav>
                </div>
            </div>
        </header>
    )
}

export default Header
