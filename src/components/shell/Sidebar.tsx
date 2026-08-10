"use client";

import {
  useEffect,
  useState,
} from "react";


type SidebarProps = {
  collapsed: boolean;
};


type NavigationItem = {
  id: string;
  label: string;
  index: string;
};


const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    index: "01",
  },
  {
    id: "slide-scan",
    label: "Slide Scan",
    index: "02",
  },
  {
    id: "experiments",
    label: "Experiments",
    index: "03",
  },
  {
    id: "validation",
    label: "Validation",
    index: "04",
  },
  {
    id: "reports",
    label: "Reports",
    index: "05",
  },
  {
    id: "hardware",
    label: "Hardware",
    index: "06",
  },
  {
    id: "settings",
    label: "Settings",
    index: "07",
  },
];


export function Sidebar({
  collapsed,
}: SidebarProps) {
  const [
    activeSection,
    setActiveSection,
  ] =
    useState(
      "overview",
    );


  useEffect(
    () => {
      let frame:
        number | null =
        null;


      function updateActiveSection() {
        if (
          frame !== null
        ) {
          return;
        }


        frame =
          window.requestAnimationFrame(
            () => {
              frame =
                null;


              const sections =
                NAVIGATION_ITEMS
                  .map(
                    (
                      item,
                    ) => {
                      const element =
                        document.getElementById(
                          item.id,
                        );


                      return element
                        ? {
                            id:
                              item.id,

                            element,
                          }
                        : null;
                    },
                  )
                  .filter(
                    (
                      item,
                    ): item is {
                      id:
                        string;

                      element:
                        HTMLElement;
                    } =>
                      item !==
                      null,
                  )
                  .sort(
                    (
                      first,
                      second,
                    ) =>
                      first
                        .element
                        .offsetTop -
                      second
                        .element
                        .offsetTop,
                  );


              let current =
                "overview";


              for (
                const section
                of sections
              ) {
                const top =
                  section.element
                    .getBoundingClientRect()
                    .top;


                if (
                  top <=
                  125
                ) {
                  current =
                    section.id;
                }
              }


              setActiveSection(
                current,
              );
            },
          );
      }


      updateActiveSection();


      window.addEventListener(
        "scroll",
        updateActiveSection,
        {
          passive:
            true,
        },
      );


      window.addEventListener(
        "resize",
        updateActiveSection,
      );


      return () => {
        window.removeEventListener(
          "scroll",
          updateActiveSection,
        );


        window.removeEventListener(
          "resize",
          updateActiveSection,
        );


        if (
          frame !== null
        ) {
          window.cancelAnimationFrame(
            frame,
          );
        }
      };
    },
    [],
  );


  function navigateTo(
    id:
      string,
  ) {
    const element =
      document.getElementById(
        id,
      );


    if (
      !element
    ) {
      return;
    }


    setActiveSection(
      id,
    );


    element.scrollIntoView(
      {
        behavior:
          "smooth",

        block:
          "start",
      },
    );
  }


  return (
    <aside className="labSidebar">
      <div className="labBrand">
        <div className="labBrandMark">
          AM
        </div>

        {!collapsed && (
          <div className="labBrandCopy">
            <strong>
              Autonomous
            </strong>

            <span>
              Microscopy
            </span>
          </div>
        )}
      </div>


      <div className="labSidebarDivider" />


      <nav
        className="labNavigation"
        aria-label="Workstation navigation"
      >
        {!collapsed && (
          <div className="labNavSectionLabel">
            WORKSPACE
          </div>
        )}


        {NAVIGATION_ITEMS.map(
          (
            item,
          ) => (
            <NavItem
              key={
                item.id
              }
              label={
                item.label
              }
              index={
                item.index
              }
              active={
                activeSection ===
                item.id
              }
              collapsed={
                collapsed
              }
              onClick={() =>
                navigateTo(
                  item.id,
                )
              }
            />
          ),
        )}
      </nav>


      <div className="labSidebarSpacer" />


      <div
        className={
          collapsed
            ? "labProtocol labProtocolCollapsed"
            : "labProtocol"
        }
      >
        <span className="labProtocolIndicator" />

        {collapsed ? (
          <span
            className="labProtocolCollapsedMark"
            title="Blood Parasite Research"
          >
            BP
          </span>
        ) : (
          <>
            <span className="labProtocolEyebrow">
              ACTIVE PROTOCOL
            </span>

            <strong>
              Blood Parasite Research
            </strong>

            <div className="labProtocolState">
              <span className="labProtocolStateDot" />

              Experimental
            </div>

            <div className="labProtocolDetails">
              <div>
                <span>
                  PURPOSE
                </span>

                <strong>
                  Engineering validation
                </strong>
              </div>

              <div>
                <span>
                  OUTPUT
                </span>

                <strong>
                  Research candidates
                </strong>
              </div>
            </div>
          </>
        )}
      </div>


      {!collapsed && (
        <div className="labSidebarFooter">
          <span>
            RESEARCH USE ONLY
          </span>

          <small>
            Not clinically validated
          </small>
        </div>
      )}
    </aside>
  );
}


function NavItem({
  label,
  index,
  active,
  collapsed,
  onClick,
}: {
  label: string;
  index: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "labNavItem labNavItemActive"
          : "labNavItem"
      }
      onClick={
        onClick
      }
      aria-current={
        active
          ? "page"
          : undefined
      }
      title={
        collapsed
          ? label
          : undefined
      }
    >
      <span className="labNavIndex">
        {index}
      </span>

      {!collapsed && (
        <span className="labNavText">
          {label}
        </span>
      )}

      {active && (
        <span
          className="labNavActiveIndicator"
          aria-hidden="true"
        />
      )}
    </button>
  );
}