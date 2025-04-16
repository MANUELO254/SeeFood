import { useEffect, useState } from "react";
import { getFoodItems } from "../services/api";

function Home() {
  const [foodItems, setFoodItems] = useState([]);

  useEffect(() => {
    getFoodItems().then(data => setFoodItems(data));
  }, []);

  return (
    <div>
      <h1>Food Recognition App</h1>
      <ul>
        {foodItems.map(food => (
          <li key={food._id}>{food.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default Home;
