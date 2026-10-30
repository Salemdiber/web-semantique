import { Link } from 'react-router'
import Dropdownone from './Dropdownone'
import Dropdowntwo from './Dropdowntwo'
import withBasePath from '@/utils/basePath'

const Banner = () => {
    return (
        <section id='Home' className='bg-banner-image pt-28 pb-20'>
            <div className='relative px-6 lg:px-8'>
                <div className='container'>
                    <div className='flex flex-col gap-4 text-center'>
                        <h1 className='leading-tight font-bold tracking-tight max-w-4xl mx-auto text-gray-900'>
                            Advance your engineering skills with our courses
                        </h1>
                        <p className='text-lg leading-8 text-gray-700'>
                            Build skills with our courses and mentor from world-class
                            companies.
                        </p>
                        <div className='backdrop-blur-md bg-white/30 border border-white/30 rounded-lg shadow-lg p-6 w-fit mx-auto'>
                            <div className='flex items-center justify-center gap-8'>
                                <div className='hidden sm:block -space-x-2 overflow-hidden'>
                                    <img
                                        className='inline-block h-12 w-12 rounded-full ring-2 ring-white'
                                        src='https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                                        alt='img1'
                                        width={12}
                                        height={12}
                                    />

                                    <img
                                        className='inline-block h-12 w-12 rounded-full ring-2 ring-white'
                                        src='https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                                        alt='img2'
                                        width={12}
                                        height={12}
                                    />
                                    <img
                                        className='inline-block h-12 w-12 rounded-full ring-2 ring-white'
                                        src='https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.25&w=256&h=256&q=80'
                                        alt='img3'
                                        width={12}
                                        height={12}
                                    />
                                    <img
                                        className='inline-block h-12 w-12 rounded-full ring-2 ring-white'
                                        src='https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                                        alt='img4'
                                        width={12}
                                        height={12}
                                    />
                                    <img
                                        className='inline-block h-12 w-12 rounded-full ring-2 ring-white'
                                        src='https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
                                        alt='img5'
                                        width={12}
                                        height={12}
                                    />
                                </div>
                                <div>
                                    <div className='flex justify-center sm:justify-start'>
                                        <h3 className='text-2xl font-semibold mr-2 text-gray-900'>4.6</h3>
                                        <img
                                            src={withBasePath('/images/banner/Stars.svg')}
                                            alt='stars-icon'
                                            width={32}
                                            height={32}
                                            className='w-[60%]'
                                        />
                                    </div>
                                    <div>
                                        <h3 className='text-sm text-gray-700'>Rated by 25k on google.</h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* DROPDOWN BUTTONS */}

                    <div className='mx-auto max-w-4xl mt-12 p-6 lg:max-w-4xl lg:px-8 bg-white rounded-lg boxshadow'>
                        <div className='grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-8 xl:gap-x-8'>
                            <div className='col-span-3'>
                                <Dropdownone />
                            </div>
                            <div className='col-span-3'>
                                <Dropdowntwo />
                            </div>
                            <div className='col-span-3 sm:col-span-2 mt-2'>
                                <Link to={'/#courses-section'}>
                                    <button className='bg-primary w-full hover:bg-transparent hover:text-primary duration-300 border border-primary text-white font-bold py-4 px-3 rounded-sm hover:cursor-pointer'>
                                        Start
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Banner
