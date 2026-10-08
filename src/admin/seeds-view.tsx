import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import type { AdminViewServerProps } from "payload";
import { SeedsRunner } from "./seeds-runner";

/**
 * The admin's Seeds page: what the code brings along for the CMS – the
 * interface texts, links and address, the legal text – run by hand, not at
 * start or deploy.
 */
export const SeedsView = ({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) => {
  const { req, locale, permissions, visibleEntities } = initPageResult;

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter className="seeds">
        <h1>Seeds</h1>
        {req.user ? (
          <>
            <p>
              Fills the CMS with what the code brings along. Fill never
              overwrites what was written here and can be run again.
            </p>
            <SeedsRunner />
          </>
        ) : (
          <p>Please log in first.</p>
        )}
      </Gutter>
    </DefaultTemplate>
  );
};

export default SeedsView;
