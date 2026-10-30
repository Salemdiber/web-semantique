import React, { useEffect, useState } from 'react'
import Slider from 'react-slick'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import withBasePath from '@/utils/basePath'

const Companies = () => {
    const settings = {
        dots: false,
        infinite: true,
        slidesToShow: 4,
        slidesToScroll: 1,
        arrows: false,
        autoplay: true,
        speed: 2000,
        autoplaySpeed: 2000,
        cssEase: 'linear',
        responsive: [
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: 4,
                    slidesToScroll: 1,
                    infinite: true,
                    dots: false,
                },
            },
            {
                breakpoint: 700,
                settings: {
                    slidesToShow: 2,
                    slidesToScroll: 1,
                    infinite: true,
                    dots: false,
                },
            },
            {
                breakpoint: 500,
                settings: {
                    slidesToShow: 1,
                    slidesToScroll: 1,
                    infinite: true,
                    dots: false,
                },
            },
        ],
    }

    const [companies, setCompianes] = useState<{ imgSrc: string }[]>([])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(withBasePath('/data/data.json'))
                if (!res.ok) throw new Error('Failed to fetch')
                const data = await res.json()
                setCompianes(data.Companiesdata)
            } catch (error) {
                console.error('Error fetching services:', error)
            }
        }
        fetchData()
    }, [])

    return (
        <section className='py-14 bg-cream'>
            <div className='container mx-auto max-w-7xl px-4'>
                <h2 className='text-lg mb-10 text-gray-600 text-center'>
                    Trusted by companies of all sizes
                </h2>
                <div>
                    <Slider {...settings}>
                        {companies.map((item, i) => (
                            <div key={i}>
                                <img
                                    src={withBasePath(item.imgSrc)}
                                    alt={item.imgSrc}
                                    width={100}
                                    height={50}
                                    className='w-auto'
                                />
                            </div>
                        ))}
                    </Slider>
                </div>
            </div>
        </section>
    )
}

export default Companies
