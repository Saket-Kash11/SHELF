import { createHashRouter, RouterProvider } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import BookDetail from './pages/BookDetail';
import Shelf from './pages/Shelf';
import ShelfDetail from './pages/ShelfDetail';
import Reader from './pages/Reader';
import Settings from './pages/Settings';
import TagBrowser from './pages/TagBrowser';
import MoodDiscovery from './pages/MoodDiscovery';


const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'search',
        element: <Search />,
      },
      {
        path: 'book/*',
        element: <BookDetail />,
      },
      {
        path: 'shelf',
        element: <Shelf />,
      },
      {
        path: 'shelf/:shelfId',
        element: <ShelfDetail />,
      },
      {
        path: 'reader',
        element: <Reader />,
      },
      {
        path: 'discover',
        element: <MoodDiscovery />,
      },

      {
        path: 'tags',
        element: <TagBrowser />,
      },
      {
        path: 'tags/:tagName',
        element: <TagBrowser />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
