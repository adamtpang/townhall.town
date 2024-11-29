import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpIcon, ArrowDownIcon, ExclamationTriangleIcon, LightBulbIcon, CurrencyDollarIcon, SparklesIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import ProblemForm from './ProblemForm';
import SolutionForm from './SolutionForm';
import SolutionDetail from './SolutionDetail';
import BountyDetail from './BountyDetail';
import BountyForm from './BountyForm';

const TAB_THEMES = {
  problems: {
    active: 'border-red-600 text-red-700',
    hover: 'hover:text-red-800',
    button: 'bg-red-600 hover:bg-red-700',
    accent: 'text-red-700',
    background: 'bg-red-100'
  },
  solutions: {
    active: 'border-blue-600 text-blue-700',
    hover: 'hover:text-blue-800',
    button: 'bg-blue-600 hover:bg-blue-700',
    accent: 'text-blue-700',
    background: 'bg-blue-100'
  },
  bounties: {
    active: 'border-green-600 text-green-700',
    hover: 'hover:text-green-800',
    button: 'bg-green-600 hover:bg-green-700',
    accent: 'text-green-700',
    background: 'bg-green-100'
  }
};

const TABS = {
  problems: {
    icon: ExclamationTriangleIcon,
    label: 'Problems',
    ...TAB_THEMES.problems
  },
  solutions: {
    icon: LightBulbIcon,
    label: 'Solutions',
    ...TAB_THEMES.solutions
  },
  bounties: {
    icon: CurrencyDollarIcon,
    label: 'Bounties',
    ...TAB_THEMES.bounties
  }
};

const Dashboard = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewProblemModal, setShowNewProblemModal] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [activeTab, setActiveTab] = useState('problems');
  const [showSolutionModal, setShowSolutionModal] = useState(null);
  const [sortBy, setSortBy] = useState('votes'); // 'votes' or 'newest'
  const [showMenu, setShowMenu] = useState(null);
  const navigate = useNavigate();
  const [filteredProblemId, setFilteredProblemId] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [selectedProblemId, setSelectedProblemId] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [selectedSolutionId, setSelectedSolutionId] = useState(null);
  const [bounties, setBounties] = useState([]);

  // Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate('/');
    });
    return () => unsubscribe();
  }, [navigate]);

  // Get user's location
  useEffect(() => {
    const getUserLocation = async () => {
      // Try to get cached location first
      const cachedLocation = localStorage.getItem('userLocation');
      if (cachedLocation) {
        const parsed = JSON.parse(cachedLocation);
        setUserLocation(parsed.coords);
        return;
      }

      fetchFreshLocation();
    };

    const fetchFreshLocation = async () => {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            maximumAge: 60000,
          });
        });

        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });

        // Cache the location data
        localStorage.setItem('userLocation', JSON.stringify({
          coords: { latitude, longitude },
          timestamp: Date.now()
        }));
      } catch (err) {
        console.warn('Location error:', err);
        setUserLocation(null);
      }
    };

    getUserLocation();
  }, []);

  // Add fetchProblems function
  const fetchProblems = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/problems');
      const data = await response.json();
      setProblems(data);
    } catch (error) {
      console.error('Error fetching problems:', error);
    } finally {
      setLoading(false);
    }
  };

  // Use fetchProblems in useEffect
  useEffect(() => {
    fetchProblems();
  }, []);

  const handleSubmitProblem = async (newProblem) => {
    try {
      const response = await fetch('http://localhost:5000/api/problems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProblem)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create problem');
      }

      setProblems(prevProblems => [data, ...prevProblems]);
      setShowNewProblemModal(false);
    } catch (error) {
      console.error('Error submitting problem:', error);
      throw error;
    }
  };

  // Simplify handleVote
  const handleVote = async (problemId, direction) => {
    try {
      const response = await fetch(`http://localhost:5000/api/problems/${problemId}/vote`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          direction,
          userId: auth.currentUser.uid
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to vote');
      }

      // Refresh problems after vote
      fetchProblems();
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleDelete = async (problemId) => {
    if (!window.confirm('Are you sure you want to delete this problem?')) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/problems/${problemId}?userId=${auth.currentUser.uid}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) throw new Error('Failed to delete problem');

      setProblems(problems.filter(p => p._id !== problemId));
    } catch (error) {
      console.error('Error deleting problem:', error);
    }
  };

  const handleSubmitSolution = async (solution) => {
    try {
      const response = await fetch('http://localhost:5000/api/solutions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(solution)
      });

      if (!response.ok) throw new Error('Failed to create solution');

      // Switch to solutions tab after submitting
      setActiveTab('solutions');
      setShowSolutionModal(null);
    } catch (error) {
      console.error('Error submitting solution:', error);
    }
  };

  // Add sorting function
  const getSortedProblems = () => {
    return [...problems].sort((a, b) => {
      if (sortBy === 'votes') {
        return (b.totalVotes || 0) - (a.totalVotes || 0);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  // Add function to fetch solutions
  const fetchSolutions = async (problemId = null) => {
    try {
      const url = problemId
        ? `http://localhost:5000/api/solutions/problem/${problemId}`
        : 'http://localhost:5000/api/solutions';

      const response = await fetch(url);
      const data = await response.json();
      setSolutions(data);
    } catch (error) {
      console.error('Error fetching solutions:', error);
    }
  };

  // Update useEffect to fetch solutions when tab or filtered problem changes
  useEffect(() => {
    if (activeTab === 'solutions') {
      fetchSolutions(filteredProblemId);
    }
  }, [activeTab, filteredProblemId]);

  // Add solution voting handler
  const handleSolutionVote = async (solutionId, direction) => {
    try {
      const response = await fetch(`http://localhost:5000/api/solutions/${solutionId}/vote`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          direction,
          userId: auth.currentUser.uid
        })
      });

      if (!response.ok) throw new Error('Failed to vote');
      fetchSolutions(filteredProblemId);
    } catch (error) {
      console.error('Error voting on solution:', error);
    }
  };

  // Add solution deletion handler
  const handleDeleteSolution = async (solutionId) => {
    if (!window.confirm('Are you sure you want to delete this solution?')) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/solutions/${solutionId}?userId=${auth.currentUser.uid}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete solution');
      fetchSolutions(filteredProblemId);
    } catch (error) {
      console.error('Error deleting solution:', error);
    }
  };

  // Add function to get location name
  const getLocationName = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();

      // Extract relevant location info (city, state, country)
      const address = data.address;
      const location = address.city || address.town || address.village || address.state;
      const country = address.country;

      setLocationName(`${location}, ${country}`);
    } catch (error) {
      console.error('Error getting location name:', error);
      setLocationName('');
    }
  };

  // Update useEffect for location
  useEffect(() => {
    if (userLocation) {
      getLocationName(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation]);

  // Add bounty handlers
  const handleSubmitBounty = async (bounty) => {
    try {
      const response = await fetch('http://localhost:5000/api/bounties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bounty)
      });

      if (!response.ok) throw new Error('Failed to create bounty');

      // Switch to bounties tab after submitting
      setActiveTab('bounties');
      setShowBountyModal(false);
    } catch (error) {
      console.error('Error submitting bounty:', error);
    }
  };

  // Add function to fetch bounties
  const fetchBounties = async (solutionId = null) => {
    try {
      const url = solutionId
        ? `http://localhost:5000/api/bounties/solution/${solutionId}`
        : 'http://localhost:5000/api/bounties';

      const response = await fetch(url);
      const data = await response.json();
      setBounties(data);
    } catch (error) {
      console.error('Error fetching bounties:', error);
    }
  };

  // Update useEffect to fetch bounties when tab changes
  useEffect(() => {
    if (activeTab === 'bounties') {
      fetchBounties();
    }
  }, [activeTab]);

  // Add bounty voting handler
  const handleBountyVote = async (bountyId, direction) => {
    try {
      const response = await fetch(`http://localhost:5000/api/bounties/${bountyId}/vote`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          direction,
          userId: auth.currentUser.uid
        })
      });

      if (!response.ok) throw new Error('Failed to vote');
      fetchBounties();
    } catch (error) {
      console.error('Error voting on bounty:', error);
    }
  };

  // Add bounty deletion handler
  const handleDeleteBounty = async (bountyId) => {
    if (!window.confirm('Are you sure you want to delete this bounty?')) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/bounties/${bountyId}?userId=${auth.currentUser.uid}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete bounty');
      fetchBounties();
    } catch (error) {
      console.error('Error deleting bounty:', error);
    }
  };

  return (
    <div className={`min-h-screen ${TAB_THEMES[activeTab].background}`}>
      <div className="max-w-3xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex border-b-2 border-gray-200 mb-6">
          {Object.entries(TABS).map(([key, tab]) => {
            const Icon = tab.icon;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`
                  py-4 px-8 text-sm font-bold capitalize
                  flex items-center gap-2
                  border-b-2 -mb-[2px] transition-all duration-200
                  hover:bg-opacity-10
                  ${activeTab === key
                    ? `${tab.active} border-current bg-${key}-50`
                    : `text-gray-400 border-transparent hover:bg-${key}-50 ${tab.hover}`
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'problems' && (
          <>
            {/* Report Problem Button and Sort Dropdown */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Local Problems
                </h1>
                {userLocation && (
                  <div className="text-sm text-gray-500 mt-1">
                    📍 {locationName || `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowNewProblemModal(true)}
                  className={`text-white px-4 py-2 rounded-lg transition-colors ${TAB_THEMES[activeTab].button} flex items-center gap-2`}
                >
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  <span>Report Problem</span>
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border rounded-md px-3 py-1.5 text-gray-600 bg-white"
                >
                  <option value="votes">Most Voted</option>
                  <option value="newest">Most Recent</option>
                </select>
              </div>
            </div>

            {/* Problem Form Modal */}
            {showNewProblemModal && (
              <ProblemForm
                onClose={() => setShowNewProblemModal(false)}
                onSubmit={handleSubmitProblem}
                userLocation={userLocation}
              />
            )}

            {/* Problems Feed */}
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="space-y-4">
                {getSortedProblems().map((problem) => (
                  <div key={problem._id} className="bg-white rounded-lg shadow p-3 hover:shadow-md transition-shadow max-w-2xl mx-auto">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => handleVote(problem._id, 'up')}
                          className={`p-0.5 rounded hover:bg-gray-100 transition-colors ${
                            problem.userVote === 'up' ? 'text-green-600' : 'text-gray-400'
                          }`}
                          title="Upvote"
                        >
                          <ArrowUpIcon className="w-5 h-5" />
                        </button>
                        <span className={`text-sm font-medium ${
                          problem.totalVotes > 0
                            ? 'text-green-600'
                            : problem.totalVotes < 0
                              ? 'text-red-600'
                              : 'text-gray-600'
                        }`}>
                          {problem.totalVotes || 0}
                        </span>
                        <button
                          onClick={() => handleVote(problem._id, 'down')}
                          className={`p-0.5 rounded hover:bg-gray-100 transition-colors ${
                            problem.userVote === 'down' ? 'text-red-600' : 'text-gray-400'
                          }`}
                          title="Downvote"
                        >
                          <ArrowDownIcon className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 text-sm text-gray-500 mb-1">
                          <div className="flex items-center gap-1.5">
                            <img
                              src={problem.author.photoURL}
                              alt=""
                              className="w-5 h-5 rounded-full"
                            />
                            <span>{problem.author.name}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(problem.createdAt))} ago</span>
                          </div>

                          {/* Settings Menu */}
                          {problem.author.uid === auth.currentUser?.uid && (
                            <div className="relative">
                              <button
                                onClick={() => setShowMenu(showMenu === problem._id ? null : problem._id)}
                                className="p-0.5 rounded-full hover:bg-gray-100"
                              >
                                <EllipsisVerticalIcon className="w-4 h-4 text-gray-400" />
                              </button>
                              {showMenu === problem._id && (
                                <div
                                  className="absolute right-0 mt-1 py-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                                  onBlur={() => setShowMenu(null)}
                                >
                                  <button
                                    onClick={() => handleDelete(problem._id)}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                  >
                                    Delete Post
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <h2 className="text-lg font-medium text-gray-900 mb-2">
                          {problem.title}
                        </h2>

                        {problem.description && (
                          <p className="text-base text-gray-600 mb-3">
                            {problem.description}
                          </p>
                        )}

                        <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => {
                              setShowSolutionModal(true);
                              setSelectedProblemId(problem._id);
                            }}
                            className="text-white px-3 py-1.5 rounded-lg transition-colors bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 text-sm"
                          >
                            <LightBulbIcon className="w-4 h-4" />
                            <span>Propose Solution</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'solutions' && (
          <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Local Solutions
                </h1>
                {userLocation && (
                  <div className="text-sm text-gray-500 mt-1">
                    📍 {locationName || `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border rounded-md px-3 py-1.5 text-gray-600 bg-white"
                >
                  <option value="votes">Most Voted</option>
                  <option value="newest">Most Recent</option>
                </select>
              </div>
            </div>

            {/* Solutions List */}
            <div className="space-y-4">
              {solutions.length > 0 ? (
                solutions.map(solution => (
                  <SolutionDetail
                    key={solution._id}
                    solution={solution}
                    onVote={handleSolutionVote}
                    onDelete={handleDeleteSolution}
                    problem={problems.find(p => p._id === solution.problemId)}
                    setShowBountyModal={setShowBountyModal}
                    setSelectedSolutionId={setSelectedSolutionId}
                    setActiveTab={setActiveTab}
                    setFilteredProblemId={setFilteredProblemId}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Care to propose a solution?</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bounties' && (
          <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Local Bounties
                </h1>
                {userLocation && (
                  <div className="text-sm text-gray-500 mt-1">
                    📍 {locationName || `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border rounded-md px-3 py-1.5 text-gray-600 bg-white"
                >
                  <option value="votes">Most Voted</option>
                  <option value="newest">Most Recent</option>
                </select>
              </div>
            </div>

            {/* Bounties List */}
            <div className="space-y-4">
              {bounties.length > 0 ? (
                bounties.map(bounty => (
                  <BountyDetail
                    key={bounty._id}
                    bounty={bounty}
                    onVote={handleBountyVote}
                    onDelete={handleDeleteBounty}
                    solution={solutions.find(s => s._id === bounty.solutionId)}
                    setActiveTab={setActiveTab}
                    setFilteredProblemId={setFilteredProblemId}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No bounties yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Solution Form Modal */}
        {showSolutionModal && (
          <SolutionForm
            onClose={() => setShowSolutionModal(null)}
            onSubmit={handleSubmitSolution}
            problem={problems.find(p => p._id === selectedProblemId)}
          />
        )}

        {/* Add Bounty Form Modal */}
        {showBountyModal && (
          <BountyForm
            onClose={() => setShowBountyModal(false)}
            onSubmit={handleSubmitBounty}
            solution={solutions.find(s => s._id === selectedSolutionId)}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;