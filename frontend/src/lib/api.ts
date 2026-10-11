const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function analyzeSkin(file: File) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_BASE_URL}/scan`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to analyze skin');
  }

  return response.json();
}

export async function getRecommendations(scanId: string, goal: string) {
  const response = await fetch(`${API_BASE_URL}/recommendations/${scanId}?goal=${encodeURIComponent(goal)}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch recommendations');
  }

  return response.json();
}

export async function saveBaseline(scanId: string) {
  const formData = new FormData();
  formData.append('scan_id', scanId);

  const response = await fetch(`${API_BASE_URL}/baseline`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to save baseline');
  }

  return response.json();
}

export async function getJourney(currentScanId: string) {
  const response = await fetch(`${API_BASE_URL}/journey?current_scan_id=${currentScanId}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch journey');
  }

  return response.json();
}

export async function demoJourneyJump() {
  const response = await fetch(`${API_BASE_URL}/demo/journey-jump`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error('Failed to jump journey in demo mode');
  }

  return response.json();
}

export async function simulateSkin(file: File, feature: string, intensity: number = 1.0) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('feature', feature);
  formData.append('intensity', intensity.toString());

  const response = await fetch(`${API_BASE_URL}/simulate`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to simulate skin');
  }

  return response.json();
}
