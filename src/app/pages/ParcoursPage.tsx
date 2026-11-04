import { useParams } from 'react-router';
import Parcours from '@/app/components/Home/Parcours';

const ParcoursPage = () => {
    const { id } = useParams<{ id?: string }>();
    return (
        <main>
            <Parcours parcoursIdInitial={id} pleinePage />
        </main>
    );
};

export default ParcoursPage;

