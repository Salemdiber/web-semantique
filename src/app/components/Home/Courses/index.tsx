import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react/dist/iconify.js'
import { CourseDetailType } from '@/app/types/coursedetail'
import withBasePath from '@/utils/basePath'
import CourseDetailSkeleton from '../../Skeleton/CourseDetail'
import { Link } from 'react-router'

interface Name {
    imageSrc: string
    course: string
    price: string
    profession: string
    category:
    | 'webdevelopment'
    | 'mobiledevelopment'
    | 'datascience'
    | 'cloudcomputing'
}

const NamesList = () => {
    // -------------------------------------------------------------
    const [courseDetail, setCourseDetail] = useState<CourseDetailType[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(withBasePath('/data/data.json'))
                if (!res.ok) throw new Error('Failed to fetch.')
                const data = await res.json()
                setCourseDetail(data.CourseDetailData)
            } catch (error) {
                console.error('Error fetching services:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])
    // -------------------------------------------------------------

    const [selectedButton, setSelectedButton] = useState<
        | 'mobiledevelopment'
        | 'webdevelopment'
        | 'datascience'
        | 'cloudcomputing'
        | 'all'
        | null
    >('webdevelopment')
    const mobileDevelopment = courseDetail.filter(
        (name) => name.category === 'mobiledevelopment'
    )
    const webDevelopment = courseDetail.filter(
        (name) => name.category === 'webdevelopment'
    )
    const dataScience = courseDetail.filter(
        (name) => name.category === 'datascience'
    )
    const cloudComputing = courseDetail.filter(
        (name) => name.category === 'cloudcomputing'
    )

    let selectedNames: Name[] = []
    if (selectedButton === 'mobiledevelopment') {
        selectedNames = mobileDevelopment
    } else if (selectedButton === 'webdevelopment') {
        selectedNames = webDevelopment
    } else if (selectedButton === 'datascience') {
        selectedNames = dataScience
    } else if (selectedButton === 'cloudcomputing') {
        selectedNames = cloudComputing
    }

    const nameElements = selectedNames.map((name, index) => (
        <div id='Courses' key={index} className='bg-white shadow-lg rounded-xl group flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300'>
            <div className='py-5 lg:py-0 flex flex-col'>
                <div className='overflow-hidden rounded-t-lg bg-gray-100'>
                    <img
                        src={withBasePath(name.imageSrc)}
                        alt={name.course}
                        width={700}
                        height={700}
                        className='h-full w-full object-cover object-center group-hover:scale-110 transition duration-300 ease-in-out'
                    />
                </div>
                <div className='p-4 flex flex-col justify-between gap-5 flex-1'>
                    <div className="flex flex-col gap-5">
                        <div className='flex items-center justify-between'>
                            <p className='block font-semibold text-gray-900 text-lg'>{name.course}</p>
                            <div className='block text-lg font-bold text-success bg-success/10 border-solid border-2 border-success rounded-md px-2 py-1'>
                                <p>${name.price}</p>
                            </div>
                        </div>
                        <Link to={'/'}>
                            <p
                                aria-hidden='true'
                                className='text-xl font-semibold text-gray-700 group-hover:text-primary group-hover:cursor-pointer transition-colors'>
                                {name.profession}
                            </p>
                        </Link>
                    </div>
                    <div className='flex justify-between items-center border-solid border-2 border-gray-200 rounded-md p-3 bg-gray-50'>
                        <p className='text-gray-600 font-medium'>12 Classes</p>
                        <div className='flex flex-row space-x-4'>
                            <div className='flex items-center'>
                                <img
                                    src={withBasePath('/images/courses/account.svg')}
                                    width={18}
                                    height={20}
                                    alt='circle'
                                />
                                <p className='text-gray-600 font-medium ml-1'>120</p>
                            </div>
                            <div className='flex items-center'>
                                <img
                                    src={withBasePath('/images/courses/Star.svg')}
                                    width={18}
                                    height={20}
                                    alt='star'
                                />
                                <p className='text-gray-600 font-medium ml-1'>4.5</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ))

    return (
        <section id='courses-section' className='py-14 bg-cream'>
            <div className='container mx-auto max-w-7xl px-4'>
                <div className='flex flex-col sm:flex-row justify-between sm:items-center gap-5 mb-4'>
                    <h2 className='font-bold tracking-tight text-gray-900'>Popular Courses</h2>
                    <div>
                        <button className='bg-transparent cursor-pointer hover:bg-primary text-primary font-medium hover:text-white py-3 px-4 border border-primary hover:border-transparent rounded-sm duration-300'>
                            Explore Classes
                        </button>
                    </div>
                </div>
                <div className='flex nowhitespace space-x-5 rounded-xl bg-white p-1 overflow-x-auto mb-4'>
                    {/* FOR DESKTOP VIEW */}
                    <button
                        onClick={() => setSelectedButton('webdevelopment')}
                        className={
                            'bg-white px-4 py-2 rounded-lg transition-all duration-300 ' +
                            (selectedButton === 'webdevelopment'
                                ? 'bg-primary text-white font-semibold shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100') +
                            ' text-lg hidden sm:block hover:cursor-pointer'
                        }>
                        Web Development
                    </button>
                    <button
                        onClick={() => setSelectedButton('mobiledevelopment')}
                        className={
                            'bg-white px-4 py-2 rounded-lg transition-all duration-300 ' +
                            (selectedButton === 'mobiledevelopment'
                                ? 'bg-primary text-white font-semibold shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100') +
                            ' text-lg hidden sm:block hover:cursor-pointer'
                        }>
                        Mobile Development
                    </button>
                    <button
                        onClick={() => setSelectedButton('datascience')}
                        className={
                            'bg-white px-4 py-2 rounded-lg transition-all duration-300 ' +
                            (selectedButton === 'datascience'
                                ? 'bg-primary text-white font-semibold shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100') +
                            ' text-lg hidden sm:block hover:cursor-pointer'
                        }>
                        Data Science
                    </button>
                    <button
                        onClick={() => setSelectedButton('cloudcomputing')}
                        className={
                            'bg-white px-4 py-2 rounded-lg transition-all duration-300 ' +
                            (selectedButton === 'cloudcomputing'
                                ? 'bg-primary text-white font-semibold shadow-md'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100') +
                            ' text-lg hidden sm:block hover:cursor-pointer'
                        }>
                        Cloud Computing
                    </button>

                    {/* FOR MOBILE VIEW */}
                    <Icon
                        icon='solar:global-line-duotone'
                        onClick={() => setSelectedButton('webdevelopment')}
                        className={
                            'text-5xl sm:hidden block ' +
                            (selectedButton === 'webdevelopment'
                                ? 'border-b-2 border-yellow-200'
                                : 'text-gray-400')
                        }
                    />

                    <Icon
                        icon='solar:smartphone-line-duotone'
                        onClick={() => setSelectedButton('mobiledevelopment')}
                        className={
                            'text-5xl sm:hidden block ' +
                            (selectedButton === 'mobiledevelopment'
                                ? 'border-b-2 border-yellow-200'
                                : 'text-gray-400')
                        }
                    />

                    <Icon
                        icon='solar:database-line-duotone'
                        onClick={() => setSelectedButton('datascience')}
                        className={
                            'text-5xl sm:hidden block ' +
                            (selectedButton === 'datascience'
                                ? 'border-b-2 border-yellow-200'
                                : 'text-gray-400')
                        }
                    />

                    <Icon
                        icon='solar:cloud-line-duotone'
                        onClick={() => setSelectedButton('cloudcomputing')}
                        className={
                            'text-5xl sm:hidden block ' +
                            (selectedButton === 'cloudcomputing'
                                ? 'border-b-2 border-yellow-200'
                                : 'text-gray-400')
                        }
                    />
                </div>
                <div>
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8'>
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <CourseDetailSkeleton key={i} />
                            ))
                        ) : nameElements.length > 0 ? (
                            nameElements
                        ) : (
                            <p>No data to show</p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}

export default NamesList
