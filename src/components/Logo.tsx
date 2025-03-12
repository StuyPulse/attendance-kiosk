import React, { useState, useEffect } from "react";
import logo from "../../assets/Battery-Vector.svg";

interface LogoProps {
    openModal: () => void;
}

export default function Logo({ openModal }: LogoProps) {
    const [downTime, setDownTime] = useState(null);

    function handleDown() {
        console.log("down", downTime);
        setDownTime(new Date());
    }

    function handleUp() {
        if (downTime === null) {
            return;
        }
        console.log("up", downTime);
        setDownTime(null);
    }

    function handleLeave() {
        console.log("leave", downTime);
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
