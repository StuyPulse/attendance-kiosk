import React, { useState, useEffect } from "react";
import pulseLogo from "../../assets/Battery.png";
import plusLogo from "../../assets/StuyPlus.png";

interface LogoProps {
    openModal: () => void;
}

export default function Logo({ openModal }: LogoProps) {
    const [downTime, setDownTime] = useState<Date | null>(null);
    const [index, setIndex] = useState(0);

    const logos = [pulseLogo, plusLogo];

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex(prevIndex => (prevIndex + 1) % logos.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    function handleDown() {
        setDownTime(new Date());
    }

    function handleUp() {
        if (downTime === null) {
            return;
        }
        setDownTime(null);
    }

    function handleLeave() {
        setDownTime(null);
    }

    useEffect(() => {
        if (downTime === null) {
            return;
        }
        const timeout = setTimeout(openModal, 500);
        return () => clearTimeout(timeout);
    }, [downTime]);

    return <div
        className="logo-stack"
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={handleLeave}>
        {logos.map((logo, logoIndex) => (
            <img
                key={logo}
                className={`logo-layer${index === logoIndex ? " active" : ""}`}
                src={logo}
                alt=""
                draggable={false}
            />
        ))}
    </div>;
}
