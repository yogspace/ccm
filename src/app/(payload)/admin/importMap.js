import { GalleryBuilder as GalleryBuilder_c8865404e7f66dba38e8e939d5b9efe8 } from '@/fields/gallery-builder'
import { CardColorField as CardColorField_c89e32564ea960d4602226693ff26cf7 } from '@/fields/card-color-field'
import { CardColorRowLabel as CardColorRowLabel_c89e32564ea960d4602226693ff26cf7 } from '@/fields/card-color-field'
import { RscEntryLexicalCell as RscEntryLexicalCell_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { RscEntryLexicalField as RscEntryLexicalField_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { LexicalDiffComponent as LexicalDiffComponent_44fe37237e0ebf4470c9990d8cb7b07e } from '@payloadcms/richtext-lexical/rsc'
import { InlineToolbarFeatureClient as InlineToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { FixedToolbarFeatureClient as FixedToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { BlocksFeatureClient as BlocksFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { AddressBlockPreview as AddressBlockPreview_2b991de822d46fb1cc5b6c5925037390 } from '@/fields/legal-blocks'
import { ContactFormBlockPreview as ContactFormBlockPreview_2b991de822d46fb1cc5b6c5925037390 } from '@/fields/legal-blocks'
import { SiteLinkLabel as SiteLinkLabel_2b991de822d46fb1cc5b6c5925037390 } from '@/fields/legal-blocks'
import { UpdatedLabel as UpdatedLabel_2b991de822d46fb1cc5b6c5925037390 } from '@/fields/legal-blocks'
import { LinkFeatureClient as LinkFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { OrderedListFeatureClient as OrderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { UnorderedListFeatureClient as UnorderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { BoldFeatureClient as BoldFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { ItalicFeatureClient as ItalicFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { HeadingFeatureClient as HeadingFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { ParagraphFeatureClient as ParagraphFeatureClient_e70f5e05f09f93e00b997edb1ef0c864 } from '@payloadcms/richtext-lexical/client'
import { AnalyticsOverview as AnalyticsOverview_a0624fd016c2f8942a26ade7dd283502 } from '@/fields/analytics/overview'
import { AnalyticsVisitors as AnalyticsVisitors_34f7beb10cb81b9a70cea51140b0b6c1 } from '@/fields/analytics/visitors'
import { AnalyticsActions as AnalyticsActions_ad6a542d4ec8235306b47d90f6274019 } from '@/fields/analytics/actions'
import { AnalyticsRange as AnalyticsRange_73ce8286c5cae4d48ec5095a15f5a7ae } from '@/fields/analytics/range'
import { TriggerStatsButton as TriggerStatsButton_eb03edef892c9c02a36f144dba4ae577 } from '@/fields/trigger-stats-button'
import { AnalyticsExcludeField as AnalyticsExcludeField_86ec8aaed1749b716c70af0352522945 } from '@/fields/analytics-exclude-field'
import { SeedsNavLink as SeedsNavLink_2806f3e9879ac831e41503f591e16ea2 } from '@/admin/seeds-nav-link'
import { SeedsView as SeedsView_8969475260d8a0cf45502aae7a4bc08a } from '@/admin/seeds-view'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'

/** @type import('payload').ImportMap */
export const importMap = {
  "@/fields/gallery-builder#GalleryBuilder": GalleryBuilder_c8865404e7f66dba38e8e939d5b9efe8,
  "@/fields/card-color-field#CardColorField": CardColorField_c89e32564ea960d4602226693ff26cf7,
  "@/fields/card-color-field#CardColorRowLabel": CardColorRowLabel_c89e32564ea960d4602226693ff26cf7,
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalCell": RscEntryLexicalCell_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/rsc#RscEntryLexicalField": RscEntryLexicalField_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/rsc#LexicalDiffComponent": LexicalDiffComponent_44fe37237e0ebf4470c9990d8cb7b07e,
  "@payloadcms/richtext-lexical/client#InlineToolbarFeatureClient": InlineToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#FixedToolbarFeatureClient": FixedToolbarFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#BlocksFeatureClient": BlocksFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@/fields/legal-blocks#AddressBlockPreview": AddressBlockPreview_2b991de822d46fb1cc5b6c5925037390,
  "@/fields/legal-blocks#ContactFormBlockPreview": ContactFormBlockPreview_2b991de822d46fb1cc5b6c5925037390,
  "@/fields/legal-blocks#SiteLinkLabel": SiteLinkLabel_2b991de822d46fb1cc5b6c5925037390,
  "@/fields/legal-blocks#UpdatedLabel": UpdatedLabel_2b991de822d46fb1cc5b6c5925037390,
  "@payloadcms/richtext-lexical/client#LinkFeatureClient": LinkFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#OrderedListFeatureClient": OrderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#UnorderedListFeatureClient": UnorderedListFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#BoldFeatureClient": BoldFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#ItalicFeatureClient": ItalicFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#HeadingFeatureClient": HeadingFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@payloadcms/richtext-lexical/client#ParagraphFeatureClient": ParagraphFeatureClient_e70f5e05f09f93e00b997edb1ef0c864,
  "@/fields/analytics/overview#AnalyticsOverview": AnalyticsOverview_a0624fd016c2f8942a26ade7dd283502,
  "@/fields/analytics/visitors#AnalyticsVisitors": AnalyticsVisitors_34f7beb10cb81b9a70cea51140b0b6c1,
  "@/fields/analytics/actions#AnalyticsActions": AnalyticsActions_ad6a542d4ec8235306b47d90f6274019,
  "@/fields/analytics/range#AnalyticsRange": AnalyticsRange_73ce8286c5cae4d48ec5095a15f5a7ae,
  "@/fields/trigger-stats-button#TriggerStatsButton": TriggerStatsButton_eb03edef892c9c02a36f144dba4ae577,
  "@/fields/analytics-exclude-field#AnalyticsExcludeField": AnalyticsExcludeField_86ec8aaed1749b716c70af0352522945,
  "@/admin/seeds-nav-link#SeedsNavLink": SeedsNavLink_2806f3e9879ac831e41503f591e16ea2,
  "@/admin/seeds-view#SeedsView": SeedsView_8969475260d8a0cf45502aae7a4bc08a,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1
}
