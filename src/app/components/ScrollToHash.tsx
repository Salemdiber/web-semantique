import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Hauteur de l'en-tête fixe, pour ne pas masquer le titre de la section. */
const DECALAGE_ENTETE = 90

/**
 * React Router ne défile pas automatiquement vers `#ancre` : ce composant
 * rétablit ce comportement (menu, liens du hero, rechargement avec hash).
 */
const ScrollToHash = () => {
    const { pathname, hash } = useLocation()

    useEffect(() => {
        if (!hash) {
            window.scrollTo({ top: 0, behavior: 'auto' })
            return
        }

        const identifiant = decodeURIComponent(hash.replace('#', ''))
        // Laisse le temps aux sections (images, AOS) de se monter.
        const minuterie = window.setTimeout(() => {
            const cible = document.getElementById(identifiant)
            if (!cible) return
            const position =
                cible.getBoundingClientRect().top + window.scrollY - DECALAGE_ENTETE
            window.scrollTo({ top: Math.max(position, 0), behavior: 'smooth' })
        }, 50)

        return () => window.clearTimeout(minuterie)
    }, [pathname, hash])

    return null
}

export default ScrollToHash
