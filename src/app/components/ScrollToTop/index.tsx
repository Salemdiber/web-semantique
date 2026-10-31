import { useEffect, useState } from 'react'

export default function ScrollToTop() {
    const [isVisible, setIsVisible] = useState(false)

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        })
    }

    useEffect(() => {
        const toggleVisibility = () => {
            setIsVisible(window.pageYOffset > 300)
        }

        window.addEventListener('scroll', toggleVisibility)

        return () => window.removeEventListener('scroll', toggleVisibility)
    }, [])

    if (!isVisible) return null

    return (
        <div className='fixed bottom-8 right-8 z-999'>
            <div
                onClick={scrollToTop}
                aria-label='scroll to top'
                className='back-to-top flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-[#102C46] text-white shadow-md transition duration-300 ease-in-out hover:bg-dark'>
                <span className='mt-[6px] h-3 w-3 rotate-45 border-l border-t border-white'></span>
            </div>
        </div>
    )
}
