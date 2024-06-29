import { useState, useEffect } from "react";

export default function Clock() {
    const [date, setDate] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            setDate(new Date());
        }, 100);

        return () => clearInterval(interval);
    }, []);

    return <div>
        <p className="date">{date.toDateString()}</p>
        <p className="time">{date.toLocaleTimeString()}</p>
    </div>;
}
