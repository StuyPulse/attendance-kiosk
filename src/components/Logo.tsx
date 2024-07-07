import React from "react";
import logo from "../../assets/Battery-Vector.svg";

interface LogoProps {
    onTripleClick: () => void;
}

export default function Logo({ onTripleClick }: LogoProps) {
    function handleClick(e: React.MouseEvent<HTMLImageElement>) {
        if (e.detail === 3) {
            onTripleClick();
        }
    }

    return <img className="logo" src={logo} alt="694" onClick={handleClick} />;
}
