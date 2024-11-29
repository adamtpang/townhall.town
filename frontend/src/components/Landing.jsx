import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, provider } from '../firebase-config'
import { signInWithPopup } from 'firebase/auth'

const Landing = () => {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const getLocationCredibility = async () => {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;

      // Define regions and their bounding boxes
      const regions = {
        guam: {
          bounds: {
            lat: [13.2, 13.7],
            lng: [144.6, 145.0]
          },
          name: 'Guam'
        }
        // Can add more regions later
      };

      // Check which regions the user has been verified in
      const verifiedRegions = Object.entries(regions).filter(([_, region]) => {
        return latitude >= region.bounds.lat[0]
            && latitude <= region.bounds.lat[1]
            && longitude >= region.bounds.lng[0]
            && longitude <= region.bounds.lng[1];
      }).map(([key, region]) => ({
        id: key,
        name: region.name,
        verifiedAt: new Date().toISOString()
      }));

      return verifiedRegions;
    } catch (err) {
      console.warn('Location verification skipped:', err);
      return [];
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')

    try {
      // Do Google sign in first
      const result = await signInWithPopup(auth, provider)

      // Then check location credibility
      const verifiedRegions = await getLocationCredibility()

      // Store user data with verified regions
      const userData = {
        email: result.user.email,
        name: result.user.displayName,
        photo: result.user.photoURL,
        verifiedRegions,
        lastLogin: new Date().toISOString()
      };

      console.log('User signed in:', userData);
      localStorage.setItem('user', JSON.stringify(userData));

      navigate('/dash')
    } catch (err) {
      console.error('Sign in error:', err)
      setError(err.message || 'Failed to sign in with Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            townhall.town
          </h1>
          <p className="text-gray-600 mb-2">
            Solve local problems, together
          </p>
          <p className="text-sm text-gray-500">
            Anyone can identify problems anywhere.<br/>
            Location verification adds credibility to your reports.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <img
              src="/google.svg"
              alt="Google"
              className="w-5 h-5"
            />
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Landing