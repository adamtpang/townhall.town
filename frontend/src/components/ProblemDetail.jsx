import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../firebase-config';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

const ProblemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('comments'); // or 'solutions'
  const [sortBy, setSortBy] = useState('newest'); // or 'votes'
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [problemRes, solutionsRes, commentsRes] = await Promise.all([
          fetch(`http://localhost:5000/api/problems/${id}`),
          fetch(`http://localhost:5000/api/solutions/problem/${id}`),
          fetch(`http://localhost:5000/api/comments/problem/${id}`)
        ]);

        const [problemData, solutionsData, commentsData] = await Promise.all([
          problemRes.json(),
          solutionsRes.json(),
          commentsRes.json()
        ]);

        setProblem(problemData);
        setSolutions(solutionsData);
        setComments(commentsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const getSortedItems = (items) => {
    return [...items].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return (b.totalVotes || 0) - (a.totalVotes || 0);
    });
  };

  if (loading) return <div>Loading...</div>;
  if (!problem) return <div>Problem not found</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to problems
      </button>

      {/* Problem Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        {/* ... Problem content similar to Dashboard ... */}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('comments')}
          className={`py-2 px-4 ${
            activeTab === 'comments'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500'
          }`}
        >
          Comments ({comments.length})
        </button>
        <button
          onClick={() => setActiveTab('solutions')}
          className={`py-2 px-4 ${
            activeTab === 'solutions'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500'
          }`}
        >
          Solutions ({solutions.length})
        </button>
      </div>

      {/* Sort Controls */}
      <div className="flex justify-end mb-4">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-sm border rounded-md px-2 py-1"
        >
          <option value="newest">Newest First</option>
          <option value="votes">Most Votes</option>
        </select>
      </div>
          
      {/* Content */}
      {activeTab === 'comments' ? (
        <div className="space-y-4">
          {/* New Comment Form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              // Add comment handling
            }}
            className="mb-6"
          >
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full p-2 border rounded-lg"
            />
          </form>

          {/* Comments List */}
          {getSortedItems(comments).map((comment) => (
            <div key={comment._id} className="flex gap-2">
              <img
                src={comment.author.photoURL}
                alt=""
                className="w-6 h-6 rounded-full"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {comment.author.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(comment.createdAt))} ago
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {comment.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Solutions List */}
          {getSortedItems(solutions).map((solution) => (
            <div key={solution._id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={solution.author.photoURL}
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
                <span className="font-medium text-sm">
                  {solution.author.name}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(solution.createdAt))} ago
                </span>
              </div>
              <h3 className="text-lg font-medium mb-2">{solution.title}</h3>
              <p className="text-gray-600 mb-4">{solution.description}</p>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Estimated Cost: ${solution.estimatedCost}</span>
                <span>Timeline: {solution.timelineInDays} days</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProblemDetail;