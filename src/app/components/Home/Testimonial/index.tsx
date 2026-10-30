import { useEffect, useState } from 'react'
import Slider from 'react-slick'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import { TestimonialType } from '@/app/types/testimonial'
import withBasePath from '@/utils/basePath'
import TestimonialSkeleton from '../../Skeleton/Testimonial'

// CAROUSEL SETTINGS

const Testimonial = () => {
    const [testimonial, setTestimonial] = useState<TestimonialType[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(withBasePath('/data/data.json'))
                if (!res.ok) throw new Error('Failed to fetch')
                const data = await res.json()
                setTestimonial(data.TestimonialData)
            } catch (error) {
                console.error('Error fetching services:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const settings = {
        dots: true,
        infinite: true,
        slidesToShow: 3,
        slidesToScroll: 1,
        arrows: false,
        autoplay: false,
        cssEase: 'linear',
        responsive: [
            {
                breakpoint: 1200,
                settings: {
                    slidesToShow: 2,
                },
            },
            {
                breakpoint: 800,
                settings: {
                    slidesToShow: 1,
                },
            },
        ],
    }
    return (
        <section id='testimonial-section' className='bg-cream py-14'>
            <div className='container'>
                <div className='flex flex-col sm:flex-row gap-5 justify-between sm:items-center mb-6'>
                    <h2 className='font-bold tracking-tight text-gray-900'>
                        What Our Happy <br /> Students Says
                    </h2>
                    <div>
                        <button className='bg-transparent cursor-pointer hover:bg-primary text-primary font-semibold hover:text-white py-3 px-4 border border-primary hover:border-transparent rounded-sm duration-300'>
                            Give Your Review
                        </button>
                    </div>
                </div>
                <p className='text-lg font-medium mb-6 text-gray-700'>
                    Build skills with our courses and mentor <br /> from world-class
                    companies.
                </p>
                <Slider {...settings}>
                    {loading
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <TestimonialSkeleton key={i} />
                        ))
                        : testimonial.map((items, i) => (
                            <div key={i}>
                                <div className='bg-white m-4 pt-8 px-12 pb-10 text-center rounded-lg'>
                                    <div className={`relative z-0 flex justify-center items-center before:absolute before:bg-[url('/images/testimonial/greenpic.svg')] before:h-6 before:w-6 before:bottom-0 before:z-10 before:left-54%`}>
                                        <img
                                            src={withBasePath(items.imgSrc)}
                                            alt='gaby'
                                            width={64}
                                            height={64}
                                            className='inline-block rounded-full ring-2 ring-white relative'
                                        />
                                    </div>
                                    <p className='text-sm pt-4 pb-2 text-gray-600'>{items.profession}</p>
                                    <p className='text-2xl font-semibold pb-3 text-gray-900'>{items.name}</p>
                                    <img
                                        src={withBasePath(items.starimg)}
                                        alt='stars-img'
                                        className='m-auto pb-6 w-[30%]'
                                        width={32}
                                        height={32}
                                    />
                                    <p className='text-lg font-medium leading-7 text-gray-700'>
                                        {items.detail}
                                    </p>
                                </div>
                            </div>
                        ))}
                </Slider>
            </div>
        </section>
    )
}

export default Testimonial
