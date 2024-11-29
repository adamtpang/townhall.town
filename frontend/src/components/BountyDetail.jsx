import { formatDistanceToNow } from 'date-fns';
import { ArrowUpIcon, ArrowDownIcon, EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { auth } from '../firebase-config';

const BountyDetail = ({ bounty, onVote, onDelete, solution, setActiveTab, setFilteredProblemId }) => {
  return (
    <div className="bg-white rounded-lg shadow p-3 hover:shadow-md transition-shadow max-w-2xl mx-auto">
      <div className="flex gap-3">
        {/* Vote buttons */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => onVote(bounty._id, 'up')}
            className={`p-0.5 rounded hover:bg-gray-100 transition-colors ${
              bounty.userVote === 'up' ? 'text-green-600' : 'text-gray-400'
            }`}
            title="Upvote"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
          <span className={`text-sm font-medium ${
            bounty.totalVotes > 0
              ? 'text-green-600'
              : bounty.totalVotes < 0
                ? 'text-red-600'
                : 'text-gray-600'
          }`}>
            {bounty.totalVotes || 0}
          </span>
          <button
            onClick={() => onVote(bounty._id, 'down')}
            className={`p-0.5 rounded hover:bg-gray-100 transition-colors ${
              bounty.userVote === 'down' ? 'text-red-600' : 'text-gray-400'
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
                src={bounty.sponsor.photoURL}
                alt=""
                className="w-5 h-5 rounded-full"
              />
              <span>{bounty.sponsor.name}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(bounty.createdAt))} ago</span>
            </div>

            {/* Settings Menu */}
            {bounty.sponsor.uid === auth.currentUser?.uid && (
              <div className="relative">
                <button
                  onClick={() => onDelete(bounty._id)}
                  className="p-0.5 rounded-full hover:bg-gray-100"
                >
                  <EllipsisVerticalIcon className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            )}
          </div>

          {/* Related Solution Link */}
          <div
            className="text-sm text-blue-600 mb-2 cursor-pointer hover:underline"
            onClick={() => {
              setActiveTab('solutions');
              setFilteredProblemId(solution?.problemId);
            }}
          >
            Bounty for solution: {solution?.title || 'Loading...'}
          </div>

          <div className="text-lg font-medium text-gray-900 mb-2">
            ${bounty.amount.toLocaleString()}
          </div>

          {bounty.description && (
            <p className="text-base text-gray-600 mb-3">
              {bounty.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BountyDetail;