import { formatDistanceToNow } from 'date-fns';
import { ArrowUpIcon, ArrowDownIcon, EllipsisVerticalIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { auth } from '../firebase-config';

const SolutionDetail = ({ solution, onVote, onDelete, problem, setShowBountyModal, setSelectedSolutionId, setActiveTab, setFilteredProblemId }) => {
  return (
    <div className="bg-white rounded-lg shadow p-3 hover:shadow-md transition-shadow max-w-2xl mx-auto">
      <div className="flex gap-3">
        {/* Vote buttons */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => onVote(solution._id, 'up')}
            className={`p-0.5 rounded hover:bg-gray-100 transition-colors ${
              solution.userVote === 'up' ? 'text-green-600' : 'text-gray-400'
            }`}
            title="Upvote"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
          <span className={`text-sm font-medium ${
            solution.totalVotes > 0
              ? 'text-green-600'
              : solution.totalVotes < 0
                ? 'text-red-600'
                : 'text-gray-600'
          }`}>
            {solution.totalVotes || 0}
          </span>
          <button
            onClick={() => onVote(solution._id, 'down')}
            className={`p-0.5 rounded hover:bg-gray-100 transition-colors ${
              solution.userVote === 'down' ? 'text-red-600' : 'text-gray-400'
            }`}
            title="Downvote"
          >
            <ArrowDownIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 text-sm text-gray-500 mb-1">
            <div className="flex items-center gap-1.5">
              <img
                src={solution.author.photoURL}
                alt=""
                className="w-5 h-5 rounded-full"
              />
              <span>{solution.author.name}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(solution.createdAt))} ago</span>
            </div>

            {/* Settings Menu */}
            {solution.author.uid === auth.currentUser?.uid && (
              <div className="relative">
                <button
                  onClick={() => onDelete(solution._id)}
                  className="p-0.5 rounded-full hover:bg-gray-100"
                >
                  <EllipsisVerticalIcon className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            )}
          </div>

          {/* Related Problem Link */}
          <div
            className="text-sm text-blue-600 mb-2 cursor-pointer hover:underline"
            onClick={() => {
              setActiveTab('problems');
              setFilteredProblemId(problem?._id);
            }}
          >
            Solution for: {problem?.title || 'Loading...'}
          </div>

          <h2 className="text-lg font-medium text-gray-900 mb-2">
            {solution.title}
          </h2>

          {solution.description && (
            <p className="text-base text-gray-600 mb-3">
              {solution.description}
            </p>
          )}

          {/* Create Bounty button */}
          <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => {
                setShowBountyModal(true);
                setSelectedSolutionId(solution._id);
              }}
              className="text-white px-3 py-1.5 rounded-lg transition-colors bg-green-600 hover:bg-green-700 flex items-center gap-1.5 text-sm"
            >
              <CurrencyDollarIcon className="w-4 h-4" />
              <span>Create Bounty</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolutionDetail;