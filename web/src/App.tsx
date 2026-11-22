import { Route, Routes } from 'react-router-dom';
import { AddonProvider, useAddon } from './context';
import { useT } from './i18n';
import { useFetch } from './lib/api';
import { Me } from './lib/types';
import { Empty, ErrorBox, PageSkeleton } from './components/ui';
import Support from './pages/Support';
import Console from './pages/Console';

/**
 * Une seule page : le rôle VÉRIFIÉ par le panel (GET /api/me) décide de la vue — le personnel (ADMIN + SUPPORT) voit la
 * console, les clients leur espace. (Le rôle du jeton lu côté navigateur ne sert à rien ici : le serveur applique les droits.)
 */
function Home() {
  const { token } = useAddon();
  const t = useT();
  const me = useFetch<Me>(token ? 'me' : null);
  if (!token) return <div className="page"><Empty icon="key" title={t('noToken')} text={t('noTokenText')} /></div>;
  if (me.loading && !me.data) return <div className="page"><PageSkeleton rows={3} /></div>;
  if (me.error && !me.data) return <div className="page"><ErrorBox message={me.error} onRetry={me.reload} /></div>;
  return me.data!.staff ? <Console me={me.data!} /> : <Support me={me.data!} />;
}

export default function App() {
  return (
    <AddonProvider>
      <Routes>
        <Route path="*" element={<Home />} />
      </Routes>
    </AddonProvider>
  );
}
