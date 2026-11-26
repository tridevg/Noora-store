import { useParams } from 'react-router';
import { CatalogView } from '../../components/storefront/CatalogView';

/** /category/:slug: the same catalogue, pinned to one category. */
export default function CategoryPage() {
  const { slug = '' } = useParams();
  return <CatalogView key={slug} categorySlug={slug} />;
}
