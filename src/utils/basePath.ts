/**
 * Prefixe les chemins d'assets avec la base de deploiement.
 * Remplace `process.env.NEXT_PUBLIC_BASE_PATH` par la variable Vite
 * `import.meta.env.BASE_URL` ('/' par defaut).
 */
export const getBasePath = (): string => {
    const base = import.meta.env.BASE_URL || '/'
    // '/' est la racine : on le normalise en chaine vide pour eviter
    // de produire des URL de type '//images/...' (URL protocole-relative).
    if (base === '/' || base === '') return ''
    return base.replace(/\/$/, '')
}

export const withBasePath = (path: string): string => {
    const base = getBasePath()
    if (!path) return base
    if (path.startsWith('/')) return `${base}${path}`
    return `${base}/${path}`
}

export default withBasePath
