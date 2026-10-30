import { Link, useNavigate } from 'react-router'
import { signIn } from '@/app/utils/auth'
import { useState } from 'react'
import toast from 'react-hot-toast'
import SocialSignIn from '../SocialSignIn'
import Logo from '@/app/components/Layout/Header/Logo'
import Loader from '@/app/components/Common/Loader'

const Signin = () => {
    const navigate = useNavigate()

    const [loginData, setLoginData] = useState({
        email: '',
        password: '',
        checkboxToggle: false,
    })
    const [loading, setLoading] = useState(false)

    const loginUser = (e: any) => {
        e.preventDefault()

        setLoading(true)
        signIn('credentials', { ...loginData, redirect: false })
            .then((callback) => {
                if (callback?.error) {
                    toast.error(callback?.error)
                    console.log(callback?.error)
                    setLoading(false)
                    return
                }

                if (callback?.ok && !callback?.error) {
                    toast.success('Login successful')
                    setLoading(false)
                    navigate('/')
                }
            })
            .catch((err) => {
                setLoading(false)
                console.log(err.message)
                toast.error(err.message)
            })
    }

    return (
        <>
            <div className='mb-10 text-center mx-auto inline-block max-w-[160px]'>
                <Logo />
            </div>

            <SocialSignIn />

            <span className="z-1 relative my-8 block text-center before:content-[''] before:absolute before:h-px before:w-[40%] before:bg-black/20 before:left-0 before:top-3 after:content-[''] after:absolute after:h-px after:w-[40%] after:bg-black/20 after:top-3 after:right-0">
                <span className='text-body-secondary relative z-10 inline-block px-3 text-base text-black'>
                    OR
                </span>
            </span>

            <form onSubmit={(e) => e.preventDefault()}>
                <div className='mb-[22px]'>
                    <input
                        type='email'
                        placeholder='Email'
                        onChange={(e) =>
                            setLoginData({ ...loginData, email: e.target.value })
                        }
                        className='w-full rounded-md border border-solid bg-transparent px-5 py-3 text-base text-dark outline-hidden transition border-gray-200 placeholder:text-gray-400 focus:border-primary focus-visible:shadow-none text-black'
                    />
                </div>
                <div className='mb-[22px]'>
                    <input
                        type='password'
                        placeholder='Password'
                        onChange={(e) =>
                            setLoginData({ ...loginData, password: e.target.value })
                        }
                        className='w-full rounded-md border border-solid bg-transparent px-5 py-3 text-base text-dark outline-hidden transition border-gray-200 placeholder:text-gray-400 focus:border-primary focus-visible:shadow-none text-black'
                    />
                </div>
                <div className='mb-9'>
                    <button
                        onClick={loginUser}
                        type='submit'
                        className='bg-primary w-full py-3 rounded-lg text-18 font-medium border text-white border-primary hover:text-primary hover:bg-transparent hover:cursor-pointer transition duration-300 ease-in-out'>
                        Sign In {loading && <Loader />}
                    </button>
                </div>
            </form>

            <Link
                to='/'
                className='mb-2 inline-block text-base text-primary hover:underline'>
                Forgot Password?
            </Link>
            <p className='text-body-secondary text-black text-base'>
                Not a member yet?{' '}
                <Link to='/' className='text-primary hover:underline'>
                    Sign Up
                </Link>
            </p>
        </>
    )
}

export default Signin
