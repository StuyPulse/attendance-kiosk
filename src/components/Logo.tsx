import React, { useState, useEffect } from "react";
import logo from "../../assets/Battery-Vector.svg";

interface LogoProps {
    openModal: () => void;
}

export default function Logo({ openModal }: LogoProps) {
    const [downTime, setDownTime] = useState(null);

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

    return <img
        className="logo"
        src={logo}
        alt="694"
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={handleLeave} />;
}
