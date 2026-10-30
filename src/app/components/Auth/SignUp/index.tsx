import { Link, useNavigate } from 'react-router'
import toast from 'react-hot-toast'
import SocialSignUp from '../SocialSignUp'
import Logo from '@/app/components/Layout/Header/Logo'
import { useState } from 'react'
import Loader from '@/app/components/Common/Loader'
const SignUp = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)

    const handleSubmit = (e: any) => {
        e.preventDefault()

        setLoading(true)
        const data = new FormData(e.currentTarget)
        const value = Object.fromEntries(data.entries())
        const finalData = { ...value }

        // Simulate registration (static site)
        new Promise((resolve) => setTimeout(resolve, 200))
            .then(() => {
                toast.success('Successfully registered')
                setLoading(false)
                navigate('/signin')
            })
            .catch((err) => {
                toast.error(err?.message || 'Registration failed')
                setLoading(false)
            })
    }

    return (
        <>
            <div className='mb-10 text-center mx-auto inline-block max-w-[160px]'>
                <Logo />
            </div>

            <SocialSignUp />

            <span className="z-1 relative my-8 block text-center before:content-[''] before:absolute before:h-px before:w-[40%] before:bg-black/20 before:left-0 before:top-3 after:content-[''] after:absolute after:h-px after:w-[40%] after:bg-black/20 after:top-3 after:right-0">
                <span className='text-body-secondary relative z-10 inline-block px-3 text-base text-black'>
                    OR
                </span>
            </span>

            <form onSubmit={handleSubmit}>
                <div className='mb-[22px]'>
                    <input
                        type='text'
                        placeholder='Name'
                        name='name'
                        required
                        className='w-full rounded-md border border-solid bg-transparent px-5 py-3 text-base text-dark outline-hidden transition border-gray-200 placeholder:text-gray-400 focus:border-primary focus-visible:shadow-none text-black'
                    />
                </div>
                <div className='mb-[22px]'>
                    <input
                        type='email'
                        placeholder='Email'
                        name='email'
                        required
                        className='w-full rounded-md border border-solid bg-transparent px-5 py-3 text-base text-dark outline-hidden transition border-gray-200 placeholder:text-gray-400 focus:border-primary focus-visible:shadow-none text-black'
                    />
                </div>
                <div className='mb-[22px]'>
                    <input
                        type='password'
                        placeholder='Password'
                        name='password'
                        required
                        className='w-full rounded-md border border-solid bg-transparent px-5 py-3 text-base text-dark outline-hidden transition border-gray-200 placeholder:text-gray-400 focus:border-primary focus-visible:shadow-none text-black'
                    />
                </div>
                <div className='mb-9'>
                    <button
                        type='submit'
                        className='flex w-full items-center text-18 font-medium justify-center rounded-md  text-white bg-primary px-5 py-3 text-darkmode transition duration-300 ease-in-out hover:bg-transparent hover:text-primary border-primary border hover:cursor-pointer'>
                        Sign Up {loading && <Loader />}
                    </button>
                </div>
            </form>

            <p className='text-body-secondary mb-4 text-black text-base'>
                By creating an account you are agree with our{' '}
                <Link to='/#' className='text-primary hover:underline'>
                    Privacy
                </Link>{' '}
                and{' '}
                <Link to='/#' className='text-primary hover:underline'>
                    Policy
                </Link>
            </p>

            <p className='text-body-secondary text-black text-base'>
                Already have an account?
                <Link to='/' className='pl-2 text-primary hover:underline'>
                    Sign In
                </Link>
            </p>
        </>
    )
}

export default SignUp
