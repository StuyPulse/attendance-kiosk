import React from "react";
import logo from "../../assets/Battery-Vector.svg";

export default function Logo() {
    function handleClick(e: React.MouseEvent<HTMLImageElement>) {
        if (e.detail !== 3) {
            return;
        }
        window.electron.exportAttendanceReport();
    }

    return <img className="logo" src={logo} alt="694" onClick={handleClick} />;
}
