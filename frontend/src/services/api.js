const API_URL = "http://localhost:5000/api"; // Adjust if needed

export const getFoodItems = async () => {
  const response = await fetch(`${API_URL}/food`);
  return response.json();
};
