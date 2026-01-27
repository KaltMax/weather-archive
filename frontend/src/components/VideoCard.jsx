import { useState, useEffect } from 'react';
import { getVideoUrl } from '../services/videoApi';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';

function VideoCard({ city, date, hour }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch video URL when city, date, or hour changes
  useEffect(() => {
    const fetchVideo = async () => {
      if (city && date && hour !== null) {
        setLoading(true);
        try {
          const url = await getVideoUrl(city, date.format('YYYY-MM-DD'), hour);
          setVideoUrl(url);
        } catch (error) {
          // Only show toast for actual errors, not for missing videos (404)
          if (!error.message.includes('No video available')) {
            toast.error('Failed to load video. Please try again later.');
          }
          setVideoUrl(null); // Clear video URL on error
        } finally {
          setLoading(false);
        }
      }
    };

    fetchVideo();
  }, [city, date, hour]);

  const renderVideoContent = () => {
    if (loading) {
      return <div className="text-gray-500">Loading video...</div>;
    }

    if (videoUrl) {
      return (
        <video
          key={`${videoUrl}-${hour}`}
          className="w-full h-full object-contain object-center"
          autoPlay
          loop
          muted
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      );
    }

    return <div className="text-gray-500">No video available</div>;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-700">
        Video Compilation
      </h2>
      <div className="flex justify-center">
        <div className="h-48 sm:h-64 md:h-80 lg:h-96 w-auto max-w-3xl bg-gray-100 rounded-lg inline-flex items-center justify-center overflow-hidden shadow-lg">
          {renderVideoContent()}
        </div>
      </div>
    </div>
  );
}

VideoCard.propTypes = {
  city: PropTypes.string,
  date: PropTypes.object, // dayjs object
  hour: PropTypes.number
};

export default VideoCard;