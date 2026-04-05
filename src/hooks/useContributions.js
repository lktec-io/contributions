import { useState, useCallback } from 'react';
import { contributionService } from '../services/contributionService';
import { getErrorMessage } from '../utils/helpers';

export const useContributions = () => {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  const fetchContributions = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await contributionService.getAll(params);
      const data = res.data.data;
      const list = data.contributions || data;
      setContributions(list);
      setTotal(data.total ?? list.length);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const createContribution = useCallback(async (data) => {
    const res = await contributionService.create(data);
    return res.data.data;
  }, []);

  const updateContribution = useCallback(async (id, data) => {
    const res = await contributionService.update(id, data);
    return res.data.data;
  }, []);

  const deleteContribution = useCallback(async (id) => {
    await contributionService.delete(id);
  }, []);

  return {
    contributions,
    loading,
    error,
    total,
    fetchContributions,
    createContribution,
    updateContribution,
    deleteContribution,
  };
};
